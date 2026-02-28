import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getCurrentProjectId } from "@/lib/project";
import { getChatProvider } from "@/lib/chat-provider";
import {
  getPageContext,
  getProjectSummary,
  getGlobalEntitySummary,
  buildSystemPrompt
} from "@/lib/chat-context";
import { createLogger } from "@/lib/logger";

const logger = createLogger("chat-route");

const TIMEOUT_MS = 60_000;

const activeChatByUser = new Map<string, boolean>();

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
  const provider = await getChatProvider();
  if (!provider) {
    return new NextResponse(null, { status: 404 });
  }

  const userId = await getSessionUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (activeChatByUser.get(userId)) {
    return NextResponse.json(
      { error: "One request at a time per user" },
      { status: 429 }
    );
  }

  let body: { messages?: ChatMessage[]; pathname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const pathname = typeof body.pathname === "string" ? body.pathname : "/";

  if (messages.length === 0) {
    return NextResponse.json(
      { error: "messages array required" },
      { status: 400 }
    );
  }

  const projectId = await getCurrentProjectId();
  if (!projectId) {
    return NextResponse.json(
      { error: "No project selected" },
      { status: 400 }
    );
  }

  activeChatByUser.set(userId, true);

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => abortController.abort(), TIMEOUT_MS);

  const cleanup = () => {
    clearTimeout(timeoutHandle);
    activeChatByUser.set(userId, false);
  };

  if (request.signal) {
    request.signal.addEventListener("abort", () => {
      abortController.abort();
      cleanup();
    });
  }

  try {
    const [pageContext, projectSummary, globalEntities] = await Promise.all([
      getPageContext(pathname, projectId),
      getProjectSummary(projectId),
      getGlobalEntitySummary(projectId)
    ]);
    const systemPrompt = buildSystemPrompt(pageContext, projectSummary, globalEntities);

    const providerStream = provider.createStream({
      systemPrompt,
      messages,
      signal: abortController.signal
    });

    const stream = new ReadableStream({
      async start(controller) {
        const reader = providerStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") controller.error(e);
        } finally {
          cleanup();
          controller.close();
        }
      },
      cancel() {
        cleanup();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store, no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (err) {
    cleanup();
    logger.error("Chat route error", { action: "POST", error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
