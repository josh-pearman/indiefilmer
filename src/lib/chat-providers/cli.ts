import { spawn } from "child_process";
import { existsSync } from "fs";
import type { ChatProvider, ChatStreamOptions } from "../chat-provider";
import { createLogger } from "@/lib/logger";

const logger = createLogger("chat-cli");

const DEFAULT_CLAUDE_PATH = `${process.env.HOME ?? "~"}/.local/bin/claude`;
const TIMEOUT_MS = 60_000;

function resolveClaudeCommand(): string {
  const fromEnv = process.env.CLAUDE_PATH?.trim();
  if (fromEnv) return fromEnv;
  if (existsSync(DEFAULT_CLAUDE_PATH)) return DEFAULT_CLAUDE_PATH;
  return "claude";
}

export class CliProvider implements ChatProvider {
  createStream(options: ChatStreamOptions): ReadableStream<Uint8Array> {
    const { systemPrompt, messages, signal } = options;
    const claudeCommand = resolveClaudeCommand();

    const promptParts: string[] = [];
    for (const m of messages) {
      const label = m.role === "user" ? "User" : "Assistant";
      promptParts.push(`${label}: ${m.content}`);
    }
    const conversationPrompt = promptParts.join("\n\n");

    const env = { ...process.env };
    delete (env as Record<string, unknown>)["CLAUDECODE"];

    const claude = spawn(
      claudeCommand,
      [
        "--print",
        "--output-format=stream-json",
        "--include-partial-messages",
        "--no-session-persistence",
        "--verbose",
        "--allowedTools",
        "",
        "--system-prompt",
        systemPrompt
      ],
      {
        env,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    claude.stdin.write(conversationPrompt);
    claude.stdin.end();

    let killed = false;
    let streamClosed = false;

    const killClaude = () => {
      if (!killed) {
        killed = true;
        claude.kill("SIGKILL");
      }
    };

    const timeoutHandle = setTimeout(killClaude, TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutHandle);
    };

    if (signal) {
      signal.addEventListener("abort", () => {
        killClaude();
        cleanup();
      });
    }

    const encoder = new TextEncoder();

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
        let buffer = "";
        claude.stdout.setEncoding("utf8");
        claude.stdout.on("data", (chunk: string) => {
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const obj = JSON.parse(trimmed) as {
                type?: string;
                event?: {
                  type?: string;
                  delta?: { type?: string; text?: string };
                };
                delta?: { text?: string };
              };
              const evt = obj.type === "stream_event" ? obj.event : obj;
              if (evt?.type === "content_block_delta" && evt.delta?.text) {
                safeEnqueue(
                  controller,
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "delta", text: evt.delta.text })}\n\n`
                  )
                );
              }
            } catch {
              // ignore
            }
          }
        });
        claude.stdout.on("end", () => {
          if (buffer.trim()) {
            try {
              const obj = JSON.parse(buffer.trim()) as {
                type?: string;
                event?: {
                  type?: string;
                  delta?: { type?: string; text?: string };
                };
                delta?: { text?: string };
              };
              const evt = obj.type === "stream_event" ? obj.event : obj;
              if (evt?.type === "content_block_delta" && evt.delta?.text) {
                safeEnqueue(
                  controller,
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "delta", text: evt.delta.text })}\n\n`
                  )
                );
              }
            } catch {
              // ignore
            }
          }
          safeEnqueue(controller, encoder.encode('data: {"type":"done"}\n\n'));
          safeClose(controller);
        });
        claude.stderr.setEncoding("utf8");
        claude.stderr.on("data", (data: string) => {
          logger.error("Claude CLI stderr output", { action: "stream", stderr: data });
        });
        claude.on("error", (err) => {
          logger.error("Claude CLI spawn error", { action: "spawn", error: String((err as Error).message) });
          safeEnqueue(
            controller,
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: String((err as Error).message) })}\n\n`
            )
          );
          safeClose(controller);
        });
        claude.on("close", () => {
          cleanup();
          safeClose(controller);
        });
      },
      cancel() {
        killClaude();
        cleanup();
      }
    });
  }
}
