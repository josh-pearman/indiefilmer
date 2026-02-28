"use client";

import { useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type ChatAction = {
  action: string;
  description: string;
  [key: string]: unknown;
};

export function useChat() {
  const pathname = usePathname();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      setError(null);
      const now = Date.now();
      const userMsg: ChatMessage = {
        id: `user-${now}`,
        role: "user",
        content: trimmed,
        createdAt: now
      };
      const assistantId = `assistant-${now}`;
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "", createdAt: now }
      ]);
      setIsStreaming(true);

      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content
        }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            pathname: pathname ?? "/"
          }),
          signal
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg =
            res.status === 429
              ? "Please wait for the current response to finish."
              : data.error ?? `Request failed (${res.status})`;
          setError(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: "" } : m
            )
          );
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("No response body");
          return;
        }

        const decoder = new TextDecoder();
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6)) as {
                  type?: string;
                  text?: string;
                  error?: string;
                };
                if (data.type === "delta" && typeof data.text === "string") {
                  assistantContent += data.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                } else if (data.type === "error" && data.error) {
                  setError(data.error);
                }
              } catch {
                // skip malformed lines
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          // user cancelled — leave partial message as-is
        } else {
          setError(e instanceof Error ? e.message : "Request failed");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: "" } : m
            )
          );
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages, pathname]
  );

  const executeAction = useCallback(
    async (action: ChatAction): Promise<string> => {
      const res = await fetch("/api/chat/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Action failed");
      }
      // Add result message to chat
      setMessages((prev) => [
        ...prev,
        {
          id: `action-result-${Date.now()}`,
          role: "assistant",
          content: data.message,
          createdAt: Date.now()
        }
      ]);
      // Refresh page data so the UI reflects the changes
      router.refresh();
      return data.message;
    },
    [router]
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const clearMessages = useCallback(() => {
    if (isStreaming) return;
    setMessages([]);
    setError(null);
  }, [isStreaming]);

  return { messages, isStreaming, error, sendMessage, executeAction, cancel, clearMessages };
}
