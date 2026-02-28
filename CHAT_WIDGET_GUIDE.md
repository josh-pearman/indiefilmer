# Chat Widget Architecture Guide

A reusable pattern for adding an AI chat assistant to a Next.js app using the local Claude CLI. The assistant streams responses via SSE, has full read access to your database for context, and can perform mutations through a confirmation-based action system.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Backend: SSE Streaming Route](#backend-sse-streaming-route)
4. [Backend: Context Builder](#backend-context-builder)
5. [Backend: Action Dispatcher](#backend-action-dispatcher)
6. [Frontend: useChat Hook](#frontend-usechat-hook)
7. [Frontend: Chat Widget UI](#frontend-chat-widget-ui)
8. [Key Patterns & Gotchas](#key-patterns--gotchas)
9. [Adapting to Another App](#adapting-to-another-app)

---

## Overview

The system has five files:

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | SSE streaming API — spawns Claude CLI, pipes response to client |
| `src/lib/chat-context.ts` | Builds system prompt with DB context (entities, page, project summary) |
| `src/app/api/chat/actions/route.ts` | Executes confirmed mutations (create/update/delete across all models) |
| `src/components/chat/use-chat.ts` | React hook — manages messages, streaming, action execution |
| `src/components/chat/chat-widget.tsx` | UI — chat bubble, markdown renderer, action cards with confirm/cancel |

**Flow:**
1. User types a message in the widget
2. `useChat` sends conversation history + current pathname to `/api/chat`
3. The API route fetches DB context, builds a system prompt, spawns the Claude CLI
4. Claude's response streams back as SSE (`text/event-stream`)
5. If the response contains action blocks, the widget renders confirm/cancel cards
6. On confirm, `useChat` POSTs the action to `/api/chat/actions`, which executes it and refreshes the page

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌───────────────┐   ┌──────────────────────────────┐   │
│  │  ChatWidget   │──▶│  useChat hook                │   │
│  │  (UI + markdown│   │  - sendMessage() → POST /api/chat
│  │   + ActionCard)│   │  - executeAction() → POST /api/chat/actions
│  └───────────────┘   └──────────────────────────────┘   │
└───────────────────────────┬─────────────┬───────────────┘
                            │ SSE stream  │ JSON POST
                            ▼             ▼
┌───────────────────────────────────────────────────────────┐
│  Next.js API Routes                                       │
│  ┌─────────────────────┐  ┌────────────────────────────┐  │
│  │ /api/chat (POST)    │  │ /api/chat/actions (POST)   │  │
│  │ - auth check        │  │ - validates action payload │  │
│  │ - fetch DB context  │  │ - executes Prisma mutation │  │
│  │ - spawn claude CLI  │  │ - revalidates page cache   │  │
│  │ - stream SSE back   │  │ - returns result message   │  │
│  └────────┬────────────┘  └────────────────────────────┘  │
│           │                                               │
│  ┌────────▼────────────┐                                  │
│  │ chat-context.ts     │                                  │
│  │ - getPageContext()  │                                  │
│  │ - getProjectSummary│                                  │
│  │ - getGlobalEntity  │                                  │
│  │   Summary()        │                                  │
│  │ - buildSystemPrompt│                                  │
│  └─────────────────────┘                                  │
└───────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Claude CLI   │
                    │  (subprocess) │
                    └───────────────┘
```

---

## Backend: SSE Streaming Route

**File:** `src/app/api/chat/route.ts`

This is the core of the system. It spawns the Claude CLI as a child process, feeds it the conversation via stdin, and streams the response back as Server-Sent Events.

### Spawning the CLI

```typescript
const CLAUDE_PATH = `${process.env.HOME ?? "~"}/.local/bin/claude`;

const claude = spawn(
  CLAUDE_PATH,
  [
    "--print",                      // Non-interactive mode
    "--output-format=stream-json",  // Get structured streaming events
    "--include-partial-messages",   // Stream partial content deltas
    "--no-session-persistence",     // Don't save conversation state
    "--verbose",                    // REQUIRED with stream-json + print
    "--allowedTools", "",           // No tool use (read-only assistant)
    "--system-prompt", systemPrompt // Inject DB context
  ],
  {
    env,                            // Must delete CLAUDECODE env var (see gotchas)
    stdio: ["pipe", "pipe", "pipe"]
  }
);

// Send conversation via stdin (not CLI arg — handles long/special-char prompts)
claude.stdin.write(conversationPrompt);
claude.stdin.end();
```

### Parsing stream-json Output

The CLI's `stream-json` format wraps Anthropic API events in an envelope:

```json
{"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hello"}}}
```

You must unwrap this envelope before checking for deltas:

```typescript
const obj = JSON.parse(trimmed);
// Unwrap the CLI envelope
const evt = obj.type === "stream_event" ? obj.event : obj;
if (evt?.type === "content_block_delta" && evt.delta?.text) {
  // Send SSE to client
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ type: "delta", text: evt.delta.text })}\n\n`)
  );
}
```

### SSE Response with ReadableStream

The route returns a `ReadableStream` as the response body:

```typescript
const stream = new ReadableStream({
  start(controller) {
    claude.stdout.on("data", (chunk) => { /* parse + enqueue deltas */ });
    claude.stdout.on("end", () => { /* send done event + close */ });
    claude.on("error", (err) => { /* send error event + close */ });
    claude.on("close", () => { /* cleanup */ });
  },
  cancel() {
    // Client disconnected — kill the child process
    killClaude();
    cleanup();
  }
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store, no-cache",
    "Connection": "keep-alive"
  }
});
```

### Concurrency & Cleanup

- **Per-user concurrency guard** via an in-memory `Map<string, boolean>` — one active request per user
- **60-second timeout** with `SIGKILL` on the CLI process
- **Abort listener** on `request.signal` kills the process if the client disconnects
- **`safeEnqueue`/`safeClose` wrappers** — critical for preventing uncaught exceptions (see gotchas)

---

## Backend: Context Builder

**File:** `src/lib/chat-context.ts`

This file builds the system prompt that gives the assistant full knowledge of your app's data.

### Three Context Layers

```typescript
const [pageContext, projectSummary, globalEntities] = await Promise.all([
  getPageContext(pathname),       // Context specific to the current page
  getProjectSummary(),            // High-level project info (title, dates, etc.)
  getGlobalEntitySummary()        // ALL data from ALL tables
]);
const systemPrompt = buildSystemPrompt(pageContext, projectSummary, globalEntities);
```

**`getPageContext(pathname)`** — Parses the URL to determine what page the user is on (e.g., `/cast/123` → fetches cast member #123 with all details). Returns a context string like "The user is viewing cast member John Smith (role: Lead)."

**`getProjectSummary()`** — Fetches top-level project metadata (name, start/end dates, status).

**`getGlobalEntitySummary()`** — The big one. Fetches ALL records from ALL tables with ALL fields. This lets the assistant answer questions like "Does everyone have an emergency contact?" or "Which scenes haven't been scheduled?"

### Compact Formatting with `kv()`

To keep the context concise for the LLM, use a key-value formatter that omits null/empty fields:

```typescript
function kv(pairs: [string, unknown][]): string {
  return pairs
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
}

// Usage:
// "name: Alice | role: Lead | phone: 555-1234"
// (email omitted because it was null)
```

### System Prompt Structure

The `buildSystemPrompt()` function assembles sections:

1. **Role** — "You are a production assistant for [project name]"
2. **PROJECT SUMMARY** — Key project details
3. **PROJECT ENTITIES** — All records from all tables (from `getGlobalEntitySummary()`)
4. **CURRENT PAGE CONTEXT** — What the user is looking at right now
5. **AVAILABLE IN-APP PAGES** — Sitemap so the assistant can link to pages
6. **ACTION CATALOG** — All available actions with parameter schemas and valid enum values
7. **ACTION RULES** — When to suggest actions vs. suggest using the UI
8. **GUIDELINES** — Formatting rules, behavior constraints

---

## Backend: Action Dispatcher

**File:** `src/app/api/chat/actions/route.ts`

When the assistant wants to make a change (create a task, update a cast member, etc.), it outputs an action block in its response. When the user confirms, this route executes it.

### Action Block Format

The assistant outputs fenced code blocks tagged `action`:

````
I can assign those tasks for you:

```action
{"action": "update_task", "description": "Assign lighting setup to Mike", "id": 5, "assignee": "Mike"}
```

```action
{"action": "update_task", "description": "Assign sound check to Sarah", "id": 8, "assignee": "Sarah"}
```
````

Each block must have:
- `action` — the handler name (e.g., `"update_task"`)
- `description` — human-readable explanation shown on the confirm card
- Additional fields specific to the action

### Handler Pattern

```typescript
type Handler = (payload: Record<string, unknown>) => Promise<string>;

const handlers: Record<string, Handler> = {
  create_task: async (p) => {
    const title = requireStr(p, "title");
    const status = optStr(p, "status") ?? "not_started";
    // ... validate + execute Prisma mutation
    return `Created task "${title}"`;
  },
  update_task: async (p) => { /* ... */ },
  delete_task: async (p) => { /* ... */ },
  // ... 40 handlers across all domains
};
```

### Validation Helpers

```typescript
function requireStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (typeof v !== "string" || !v.trim()) throw new Error(`${key} is required`);
  return v.trim();
}
function optStr(p: Record<string, unknown>, key: string): string | undefined { /* ... */ }
function optNum(p: Record<string, unknown>, key: string): number | undefined { /* ... */ }
function optDate(p: Record<string, unknown>, key: string): Date | undefined { /* ... */ }
function requireArr(p: Record<string, unknown>, key: string): unknown[] { /* ... */ }
function oneOf<T extends string>(value: string, allowed: T[], label: string): T { /* ... */ }
```

### After Mutation

Every handler calls `revalidatePath("/", "layout")` to bust the Next.js cache so the UI reflects changes immediately when `router.refresh()` is called on the frontend.

---

## Frontend: useChat Hook

**File:** `src/components/chat/use-chat.ts`

A React hook that manages chat state, SSE streaming, and action execution.

### State

```typescript
const [messages, setMessages] = useState<ChatMessage[]>([]);
const [isStreaming, setIsStreaming] = useState(false);
const [error, setError] = useState<string | null>(null);
const abortRef = useRef<AbortController | null>(null);
```

### `sendMessage(content)`

1. Adds user message + empty assistant message to state
2. POSTs conversation history + pathname to `/api/chat`
3. Reads the SSE stream via `res.body.getReader()`
4. Parses `data: {...}` lines and accumulates assistant content
5. Updates the assistant message in state on each delta

```typescript
const reader = res.body?.getReader();
const decoder = new TextDecoder();
let assistantContent = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = JSON.parse(line.slice(6));
      if (data.type === "delta" && typeof data.text === "string") {
        assistantContent += data.text;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: assistantContent } : m)
        );
      }
    }
  }
}
```

### `executeAction(action)`

POSTs the action payload to `/api/chat/actions`, appends the result as a new assistant message, and calls `router.refresh()` to update the page.

### `cancel()`

Aborts the in-flight fetch via `AbortController`. The partial response is preserved in the message list.

---

## Frontend: Chat Widget UI

**File:** `src/components/chat/chat-widget.tsx`

### Action Block Extraction

A regex strips action blocks from the assistant's text and parses them into structured objects:

```typescript
const ACTION_BLOCK_RE = /```action\n([\s\S]*?)```/g;

function extractActions(text: string): { cleanText: string; actions: ChatAction[] } {
  const actions: ChatAction[] = [];
  const cleanText = text.replace(ACTION_BLOCK_RE, (_, json: string) => {
    try {
      const parsed = JSON.parse(json.trim());
      if (parsed && typeof parsed.action === "string") {
        actions.push(parsed);
      }
    } catch { return _; }  // malformed — leave as text
    return "";
  });
  return { cleanText, actions };
}
```

**Important:** Actions are only extracted from non-streaming messages. During streaming, the JSON may be incomplete, so the raw text is shown until the stream finishes.

### ActionCard Component

Four states: `pending` → `executing` → `done` (or `cancelled`)

```
┌──────────────────────────────────────┐
│  Assign lighting setup to Mike       │
│  [Confirm]  [Cancel]                 │  ← pending
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ⟳ Executing…                        │  ← executing
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  ✓ Assign lighting setup to Mike — Done │  ← done
└──────────────────────────────────────┘
```

States are tracked in the widget via `Record<string, ActionState>` keyed by `${messageId}-${actionIndex}`.

### Inline Markdown Renderer

A lightweight renderer that supports: **bold**, *italic*, `code`, [links](/path), and `- bullet lists`. In-app links (starting with `/`) use Next.js `<Link>`, external links use `<a target="_blank">`.

---

## Key Patterns & Gotchas

### 1. `--verbose` is Required
When using `--print` with `--output-format=stream-json`, you must also pass `--verbose`. Without it, the CLI errors out.

### 2. Delete the `CLAUDECODE` Environment Variable
If your app is running inside a Claude Code session, the `CLAUDECODE` env var will cause the spawned CLI to think it's a nested session and fail. Delete it before spawning:

```typescript
const env = { ...process.env };
delete (env as Record<string, unknown>)["CLAUDECODE"];
```

### 3. `safeEnqueue` / `safeClose` Wrappers Are Critical
In the `ReadableStream`, Node.js stream event handlers (`stdout.on("data")`, `stdout.on("end")`, `claude.on("error")`) fire asynchronously. If the client disconnects, the `ReadableStreamDefaultController` may already be closed. Calling `controller.enqueue()` or `controller.close()` on a closed controller throws an uncaught exception that **crashes the Node.js process** (502 errors).

Always wrap these calls:

```typescript
let streamClosed = false;

const safeEnqueue = (controller, data) => {
  try { if (!streamClosed) controller.enqueue(data); } catch {}
};

const safeClose = (controller) => {
  try { if (!streamClosed) { streamClosed = true; controller.close(); } } catch {}
};
```

### 4. Conversation via stdin, Not CLI Argument
Long conversations or messages with special characters will break if passed as a CLI argument. Write the prompt to `claude.stdin` instead:

```typescript
claude.stdin.write(conversationPrompt);
claude.stdin.end();
```

### 5. Stream-json Envelope Unwrapping
The CLI wraps API events in `{"type": "stream_event", "event": {...}}`. You must unwrap before checking for `content_block_delta`:

```typescript
const evt = obj.type === "stream_event" ? obj.event : obj;
```

### 6. Per-User Concurrency
Use an in-memory Map to limit one active chat request per user. The Claude CLI is expensive — you don't want multiple processes per user.

### 7. Action Blocks During Streaming
Never try to parse action blocks from a message that's still streaming. The JSON will be incomplete. Only extract actions after the stream finishes (`isStreaming === false`).

---

## Adapting to Another App

To add this chat system to a different Next.js app:

### Step 1: Copy the Five Files
- `src/app/api/chat/route.ts` — works as-is (may need to adjust auth)
- `src/components/chat/use-chat.ts` — works as-is
- `src/components/chat/chat-widget.tsx` — works as-is (depends on your UI library for Button, ScrollArea)

### Step 2: Rewrite the Context Builder
`src/lib/chat-context.ts` is the most app-specific file. You need to:
- Replace all Prisma queries with your own models
- Update `getPageContext()` to match your app's route structure
- Update `getGlobalEntitySummary()` to fetch your entities
- Update `buildSystemPrompt()` with your action catalog and guidelines

### Step 3: Rewrite the Action Dispatcher
`src/app/api/chat/actions/route.ts` needs new handlers for your app's mutations. Keep the pattern:
- Validation helpers (`requireStr`, `optStr`, etc.)
- Handler map (`Record<string, Handler>`)
- Always revalidate after mutations
- Return a human-readable success message

### Step 4: Add the Widget to Your Layout
```tsx
// src/app/layout.tsx
import { ChatWidget } from "@/components/chat/chat-widget";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
```

### Step 5: Ensure Claude CLI is Available
The system expects `~/.local/bin/claude` to exist. Users need the Claude CLI installed locally. For production, you'd want to replace the CLI spawning with direct Anthropic API calls (see below).

### Production Considerations

- **Replace CLI with API**: For production, replace the `spawn()` call with the Anthropic SDK's streaming API (`client.messages.stream()`). This removes the CLI dependency and gives you more control.
- **Rate limiting**: The in-memory concurrency Map doesn't survive server restarts. Use Redis for production.
- **Context size**: `getGlobalEntitySummary()` fetches everything. For large datasets, consider pagination or summarization.
- **Cost**: Every message sends the full system prompt + conversation history. Consider truncating old messages.
- **Auth**: Replace `getSessionUser()` with your auth system.
