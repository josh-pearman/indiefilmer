/**
 * Chat provider abstraction for Phase 4.
 * Supports CLI (Claude CLI) or API (Anthropic SDK) via CHAT_MODE env.
 * Providers are loaded dynamically so the Anthropic SDK is not loaded when using CLI or off.
 */

export type ChatStreamOptions = {
  systemPrompt: string;
  messages: { role: "user" | "assistant"; content: string }[];
  signal?: AbortSignal;
};

export type ChatProvider = {
  createStream(options: ChatStreamOptions): ReadableStream<Uint8Array>;
};

export async function getChatProvider(): Promise<ChatProvider | null> {
  const mode = process.env.CHAT_MODE ?? "off";
  if (mode === "cli") {
    const { CliProvider } = await import("./chat-providers/cli");
    return new CliProvider();
  }
  if (mode === "api") {
    const { ApiProvider } = await import("./chat-providers/api");
    return new ApiProvider();
  }
  return null;
}

/** Check if chat is enabled (for layout/widget). */
export function isChatEnabled(): boolean {
  const mode = process.env.CHAT_MODE ?? "off";
  return mode === "cli" || mode === "api";
}
