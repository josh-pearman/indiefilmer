import Anthropic from "@anthropic-ai/sdk";
import type { ChatProvider, ChatStreamOptions } from "../chat-provider";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

export class ApiProvider implements ChatProvider {
  createStream(options: ChatStreamOptions): ReadableStream<Uint8Array> {
    const { systemPrompt, messages, signal } = options;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey?.trim()) {
      return new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: "ANTHROPIC_API_KEY is not set. Set it in .env when using CHAT_MODE=api." })}\n\n`
            )
          );
          controller.close();
        }
      });
    }

    const client = new Anthropic({ apiKey });

    const anthropicMessages = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));

    const stream = client.messages.stream({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: anthropicMessages
    });

    if (signal) {
      signal.addEventListener("abort", () => stream.abort());
    }

    const encoder = new TextEncoder();
    let streamClosed = false;

    const safeEnqueue = (controller: ReadableStreamDefaultController<Uint8Array>, data: Uint8Array) => {
      try {
        if (!streamClosed) controller.enqueue(data);
      } catch {
        // ignore
      }
    };

    const safeClose = (controller: ReadableStreamDefaultController<Uint8Array>) => {
      try {
        if (!streamClosed) {
          streamClosed = true;
          controller.close();
        }
      } catch {
        // ignore
      }
    };

    return new ReadableStream<Uint8Array>({
      start(controller) {
        stream.on("text", (textDelta: string) => {
          safeEnqueue(
            controller,
            encoder.encode(
              `data: ${JSON.stringify({ type: "delta", text: textDelta })}\n\n`
            )
          );
        });

        stream.on("end", () => {
          safeEnqueue(controller, encoder.encode('data: {"type":"done"}\n\n'));
          safeClose(controller);
        });

        stream.on("error", (err: Error) => {
          safeEnqueue(
            controller,
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: String(err.message) })}\n\n`
            )
          );
          safeClose(controller);
        });

        stream.on("abort", () => {
          safeClose(controller);
        });
      },
      cancel() {
        stream.abort();
      }
    });
  }
}
