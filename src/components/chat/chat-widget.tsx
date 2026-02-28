"use client";

import * as React from "react";
import Link from "next/link";
import {
  MessageCircle,
  X,
  Check,
  Loader2,
  Trash2,
  Copy,
  ClipboardCheck,
  Maximize2,
  Minimize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  useChat,
  type ChatMessage as ChatMessageType,
  type ChatAction
} from "./use-chat";

function isInAppPath(href: string): boolean {
  return (
    typeof href === "string" &&
    href.startsWith("/") &&
    !href.startsWith("//")
  );
}

// ---------------------------------------------------------------------------
// Action block extraction
// ---------------------------------------------------------------------------

const ACTION_BLOCK_RE = /```action\n([\s\S]*?)```/g;

function extractActions(text: string): {
  cleanText: string;
  actions: ChatAction[];
} {
  const actions: ChatAction[] = [];
  const cleanText = text.replace(ACTION_BLOCK_RE, (_, json: string) => {
    try {
      const parsed = JSON.parse(json.trim());
      if (parsed && typeof parsed.action === "string") {
        actions.push(parsed as ChatAction);
      }
    } catch {
      return _;
    }
    return "";
  });
  return { cleanText, actions };
}

// ---------------------------------------------------------------------------
// Typing indicator (three bouncing dots)
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="mr-auto flex items-center gap-1 rounded-lg bg-secondary px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-2 w-2 rounded-full bg-muted-foreground"
          style={{
            animation: `typing-dot 1.4s ease-in-out ${i * 0.2}s infinite`
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-1.5 top-1.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-background/20"
      aria-label="Copy message"
    >
      {copied ? (
        <ClipboardCheck className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ActionCard
// ---------------------------------------------------------------------------

type ActionState = "pending" | "executing" | "done" | "cancelled";

function ActionCard({
  action,
  state,
  onConfirm,
  onCancel
}: {
  action: ChatAction;
  state: ActionState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (state === "done") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span>{action.description} — Done</span>
      </div>
    );
  }
  if (state === "cancelled") {
    return (
      <div className="mt-2 rounded border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground line-through">
        {action.description} — Cancelled
      </div>
    );
  }
  return (
    <div className="mt-2 rounded border border-border bg-muted/50 px-3 py-2">
      <p className="text-sm font-medium">{action.description}</p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={state === "executing"}
          className="h-7 text-xs"
        >
          {state === "executing" ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Executing…
            </>
          ) : (
            "Confirm"
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={state === "executing"}
          className="h-7 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline markdown parser
// ---------------------------------------------------------------------------

type InlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; label: string; href: string };

function parseInline(str: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let last = 0;
  while (i < str.length) {
    const linkOpen = str.indexOf("[", i);
    const linkClose = linkOpen >= 0 ? str.indexOf("]", linkOpen) : -1;
    const parenOpen = linkClose >= 0 ? str.indexOf("(", linkClose) : -1;
    const parenClose = parenOpen >= 0 ? str.indexOf(")", parenOpen) : -1;
    const hasLink =
      linkOpen === i &&
      linkClose > linkOpen &&
      parenOpen === linkClose + 1 &&
      parenClose > parenOpen;
    if (hasLink) {
      if (i > last) tokens.push({ type: "text", value: str.slice(last, i) });
      const label = str.slice(linkOpen + 1, linkClose);
      const href = str.slice(parenOpen + 1, parenClose);
      tokens.push({ type: "link", label, href });
      i = last = parenClose + 1;
      continue;
    }
    if (str.slice(i, i + 2) === "**") {
      const end = str.indexOf("**", i + 2);
      if (end >= 0) {
        if (i > last)
          tokens.push({ type: "text", value: str.slice(last, i) });
        const inner = str.slice(i + 2, end);
        if (inner) tokens.push({ type: "bold", value: inner });
        i = last = end + 2;
        continue;
      }
    }
    if (str[i] === "*" && str[i + 1] !== "*") {
      const end = str.indexOf("*", i + 1);
      if (end >= 0) {
        if (i > last)
          tokens.push({ type: "text", value: str.slice(last, i) });
        const inner = str.slice(i + 1, end);
        if (inner) tokens.push({ type: "italic", value: inner });
        i = last = end + 1;
        continue;
      }
    }
    if (str[i] === "`") {
      const end = str.indexOf("`", i + 1);
      if (end >= 0) {
        if (i > last)
          tokens.push({ type: "text", value: str.slice(last, i) });
        tokens.push({ type: "code", value: str.slice(i + 1, end) });
        i = last = end + 1;
        continue;
      }
    }
    const nextSpecial = str.slice(i).search(/[\*`\[]/);
    if (nextSpecial < 0) {
      if (i < str.length)
        tokens.push({ type: "text", value: str.slice(last) });
      break;
    }
    const next = i + nextSpecial;
    if (next > i) {
      tokens.push({ type: "text", value: str.slice(last, next) });
      last = next;
    }
    i = next > i ? next : i + 1;
  }
  if (tokens.length === 0 && str)
    tokens.push({ type: "text", value: str });
  return tokens;
}

function renderInlineTokens(
  tokens: InlineToken[],
  keyOffset: number
): React.ReactNode[] {
  let key = keyOffset;
  return tokens.map((t) => {
    if (t.type === "text")
      return <React.Fragment key={key++}>{t.value}</React.Fragment>;
    if (t.type === "bold") return <strong key={key++}>{t.value}</strong>;
    if (t.type === "italic") return <em key={key++}>{t.value}</em>;
    if (t.type === "code")
      return (
        <code
          key={key++}
          className="rounded bg-muted px-1 py-0.5 text-xs"
        >
          {t.value}
        </code>
      );
    if (t.type === "link") {
      const href = t.href ?? "#";
      if (isInAppPath(href)) {
        return (
          <Link
            key={key++}
            href={href}
            className="text-primary underline hover:no-underline"
          >
            {t.label}
          </Link>
        );
      }
      return (
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:no-underline"
        >
          {t.label}
        </a>
      );
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Markdown renderer (fenced code blocks + inline formatting)
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode {
  if (!text.trim()) return null;

  // Split by fenced code blocks: ```lang\ncode\n```
  const CODE_BLOCK_RE = /```(\w*)\n([\s\S]*?)```/g;
  const segments: Array<
    { type: "text"; content: string } | { type: "code"; content: string; lang?: string }
  > = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({
      type: "code",
      content: match[2],
      lang: match[1] || undefined
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  const parts: React.ReactNode[] = [];
  let key = 0;

  for (const segment of segments) {
    if (segment.type === "code") {
      parts.push(
        <pre
          key={key++}
          className="my-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed"
        >
          <code>{segment.content}</code>
        </pre>
      );
    } else {
      const lines = segment.content.split("\n");
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li];
        if (li > 0) parts.push(<br key={`br-${key++}`} />);

        // Numbered lists: 1. item
        const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
          const tokens = parseInline(numberedMatch[2]);
          parts.push(
            <span key={key++} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">
                {numberedMatch[1]}.
              </span>
              <span>{renderInlineTokens(tokens, key)}</span>
            </span>
          );
          key += tokens.length;
          continue;
        }

        // Bullet lists: - item or * item
        const bulletMatch = line.match(/^[-*]\s+(.+)$/);
        if (bulletMatch) {
          const tokens = parseInline(bulletMatch[1]);
          parts.push(
            <span key={key++} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">&bull;</span>
              <span>{renderInlineTokens(tokens, key)}</span>
            </span>
          );
          key += tokens.length;
          continue;
        }

        // Headers: ## Heading
        const headerMatch = line.match(/^#{1,3}\s+(.+)$/);
        if (headerMatch) {
          const tokens = parseInline(headerMatch[1]);
          parts.push(
            <strong key={key++}>{renderInlineTokens(tokens, key)}</strong>
          );
          key += tokens.length;
          continue;
        }

        // Regular inline text
        const tokens = parseInline(line);
        parts.push(
          <span key={key++}>{renderInlineTokens(tokens, key)}</span>
        );
        key += tokens.length;
      }
    }
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

// ---------------------------------------------------------------------------
// ChatBubble
// ---------------------------------------------------------------------------

function ChatBubble({
  message,
  isStreaming,
  actionStates,
  onConfirmAction,
  onCancelAction
}: {
  message: ChatMessageType;
  isStreaming: boolean;
  actionStates: Record<string, ActionState>;
  onConfirmAction: (key: string, action: ChatAction) => void;
  onCancelAction: (key: string) => void;
}) {
  const isUser = message.role === "user";

  const { cleanText, actions } =
    !isUser && !isStreaming
      ? extractActions(message.content)
      : { cleanText: message.content, actions: [] };

  return (
    <div className="flex flex-col gap-0.5">
      <div
        className={cn(
          "group relative max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "ml-auto bg-primary text-primary-foreground"
            : "mr-auto bg-secondary text-secondary-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {renderMarkdown(cleanText)}
            {isStreaming && cleanText && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />
            )}
            {actions.map((action, idx) => {
              const key = `${message.id}-${idx}`;
              return (
                <ActionCard
                  key={key}
                  action={action}
                  state={actionStates[key] ?? "pending"}
                  onConfirm={() => onConfirmAction(key, action)}
                  onCancel={() => onCancelAction(key)}
                />
              );
            })}
          </div>
        )}
        {!isUser && !isStreaming && cleanText && (
          <CopyMessageButton text={cleanText} />
        )}
      </div>
      <span
        className={cn(
          "px-1 text-[10px] text-muted-foreground/50",
          isUser ? "ml-auto" : "mr-auto"
        )}
      >
        {formatTimestamp(message.createdAt)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggested prompts for empty state
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "What's the status of my tasks?",
  "Summarize the budget",
  "Who's in the cast?"
];

// ---------------------------------------------------------------------------
// ChatWidget
// ---------------------------------------------------------------------------

export function ChatWidget() {
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    executeAction,
    clearMessages
  } = useChat();
  const [open, setOpen] = React.useState(false);
  const [isMaximized, setIsMaximized] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [actionStates, setActionStates] = React.useState<
    Record<string, ActionState>
  >({});
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const maximizeBtnRef = React.useRef<HTMLButtonElement>(null);
  const prevMaximizedRef = React.useRef<boolean | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Show typing dots when streaming and assistant has no content yet
  const lastMsg = messages[messages.length - 1];
  const showTypingDots =
    isStreaming && lastMsg?.role === "assistant" && !lastMsg.content;

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showTypingDots]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isMaximized) {
          setIsMaximized(false);
        } else {
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isMaximized]);

  React.useEffect(() => {
    if (!open) { prevMaximizedRef.current = null; return; }
    if (prevMaximizedRef.current === null) {
      prevMaximizedRef.current = isMaximized;
      return; // widget just opened — don't steal focus
    }
    if (prevMaximizedRef.current !== isMaximized) {
      prevMaximizedRef.current = isMaximized;
      if (isMaximized) inputRef.current?.focus();
      else maximizeBtnRef.current?.focus();
    }
  }, [isMaximized, open]);

  React.useEffect(() => {
    if (!isMaximized) return;
    const panel = panelRef.current;
    if (!panel) return;
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [isMaximized]);

  const doSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSubmit();
    }
  };

  const handleConfirmAction = React.useCallback(
    async (key: string, action: ChatAction) => {
      setActionStates((prev) => ({ ...prev, [key]: "executing" }));
      try {
        await executeAction(action);
        setActionStates((prev) => ({ ...prev, [key]: "done" }));
      } catch {
        setActionStates((prev) => ({ ...prev, [key]: "pending" }));
      }
    },
    [executeAction]
  );

  const handleCancelAction = React.useCallback((key: string) => {
    setActionStates((prev) => ({ ...prev, [key]: "cancelled" }));
  }, []);

  return (
    <div className="no-print fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div
          ref={panelRef}
          className={cn(
            "flex flex-col overflow-hidden border border-border bg-card text-card-foreground",
            isMaximized
              ? "fixed inset-4 z-[60] h-auto w-auto rounded-2xl shadow-2xl max-sm:inset-0 max-sm:rounded-none"
              : "h-[520px] max-h-[calc(100dvh-6rem)] w-[400px] rounded-lg shadow-lg max-md:w-[calc(100vw-2rem)]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Chat</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  clearMessages();
                  setActionStates({});
                }}
                disabled={isStreaming || messages.length === 0}
                aria-label="Clear messages"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                ref={maximizeBtnRef}
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                onClick={() => setIsMaximized((prev) => !prev)}
                aria-label={isMaximized ? "Restore chat" : "Expand chat to full screen"}
              >
                {isMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setOpen(false); setIsMaximized(false); }}
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-3">
            <div
              className="flex flex-col gap-3"
              aria-live="polite"
              aria-atomic="false"
            >
              {/* Empty state with suggestions */}
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center gap-4 px-4 py-8">
                  <div className="rounded-full bg-muted p-3">
                    <MessageCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Project Assistant</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ask about your project, cast, schedule, or budget.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => sendMessage(s)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((m) => {
                const isLastAssistant =
                  m.role === "assistant" &&
                  m.id === lastMsg?.id;
                // Don't render the empty assistant placeholder — typing dots handle it
                if (isLastAssistant && isStreaming && !m.content) return null;
                return (
                  <ChatBubble
                    key={m.id}
                    message={m}
                    isStreaming={isStreaming && isLastAssistant}
                    actionStates={actionStates}
                    onConfirmAction={handleConfirmAction}
                    onCancelAction={handleCancelAction}
                  />
                );
              })}

              {/* Typing dots */}
              {showTypingDots && <TypingIndicator />}
            </div>
          </ScrollArea>

          {/* Error banner */}
          {error && (
            <div className="border-t border-border bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-border p-2">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              ref={inputRef}
              id="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={2}
              disabled={isStreaming}
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <Button
              type="submit"
              size="sm"
              className="mt-2 w-full"
              disabled={isStreaming || !input.trim()}
            >
              Send
            </Button>
          </form>
        </div>
      )}

      {/* Toggle button — hidden when maximized so it doesn't float over the panel */}
      {!isMaximized && (
        <Button
          size="icon"
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close chat" : "Open chat"}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}
