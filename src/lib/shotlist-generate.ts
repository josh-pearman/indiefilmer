/**
 * Shot list generation using CLI or API provider.
 * Separate from the chat system — uses a much longer timeout
 * since shot list generation can take several minutes for many scenes.
 */

import { spawn } from "child_process";
import { existsSync } from "fs";
import { createLogger } from "@/lib/logger";

const logger = createLogger("shotlist-generate");

// 5 minutes — shot list generation for 10+ scenes can be slow
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;

type GenerationResult = {
  text: string;
  error?: string;
};

/**
 * Returns the chat mode and whether auto-generation is available.
 * Safe to call from server components.
 */
export function getShotlistGenerationMode(): "cli" | "api" | "off" {
  const mode = process.env.CHAT_MODE ?? "off";
  if (mode === "cli" || mode === "api") return mode;
  return "off";
}

/**
 * Generate a shot list by calling the AI directly.
 * Works with CLI or API mode. Returns the raw text response.
 */
export async function generateShotlist(
  prompt: string,
  signal?: AbortSignal
): Promise<GenerationResult> {
  const mode = getShotlistGenerationMode();

  if (mode === "cli") {
    return generateViaCli(prompt, signal);
  }

  if (mode === "api") {
    return generateViaApi(prompt, signal);
  }

  return { text: "", error: "Shot list generation is not available (CHAT_MODE is off)" };
}

// ─── CLI generation ──────────────────────────────────────

function resolveClaudeCommand(): string {
  const fromEnv = process.env.CLAUDE_PATH?.trim();
  if (fromEnv) return fromEnv;
  const defaultPath = `${process.env.HOME ?? "~"}/.local/bin/claude`;
  if (existsSync(defaultPath)) return defaultPath;
  return "claude";
}

function generateViaCli(prompt: string, signal?: AbortSignal): Promise<GenerationResult> {
  return new Promise((resolve) => {
    const claudeCommand = resolveClaudeCommand();

    const env = { ...process.env };
    delete (env as Record<string, unknown>)["CLAUDECODE"];

    const claude = spawn(
      claudeCommand,
      [
        "--print",
        "--no-session-persistence",
        "--verbose",
        "--allowedTools",
        "",
        "--system-prompt",
        "You are a shot list generator for an indie film production app. Return ONLY valid JSON as specified in the user prompt. No markdown, no explanation, no code fences — just the JSON object."
      ],
      {
        env,
        stdio: ["pipe", "pipe", "pipe"]
      }
    );

    claude.stdin.write(prompt);
    claude.stdin.end();

    let stdout = "";
    let stderr = "";
    let killed = false;

    const kill = () => {
      if (!killed) {
        killed = true;
        claude.kill("SIGKILL");
      }
    };

    const timeout = setTimeout(() => {
      logger.error("Shot list generation timed out", { timeoutMs: GENERATION_TIMEOUT_MS });
      kill();
      resolve({ text: "", error: "Generation timed out. Try with fewer scenes." });
    }, GENERATION_TIMEOUT_MS);

    if (signal) {
      signal.addEventListener("abort", () => {
        kill();
        clearTimeout(timeout);
        resolve({ text: "", error: "Generation cancelled" });
      });
    }

    claude.stdout.setEncoding("utf8");
    claude.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    claude.stderr.setEncoding("utf8");
    claude.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    claude.on("error", (err) => {
      clearTimeout(timeout);
      logger.error("CLI spawn error during shot list generation", { error: String(err.message) });
      resolve({ text: "", error: `Failed to start Claude CLI: ${err.message}` });
    });

    claude.on("close", (code) => {
      clearTimeout(timeout);
      if (killed) return; // already resolved

      if (stderr) {
        logger.warn("CLI stderr during shot list generation", { stderr: stderr.slice(0, 500) });
      }

      if (code !== 0 && !stdout.trim()) {
        resolve({ text: "", error: `Claude CLI exited with code ${code}` });
        return;
      }

      resolve({ text: stdout });
    });
  });
}

// ─── API generation ──────────────────────────────────────

async function generateViaApi(prompt: string, signal?: AbortSignal): Promise<GenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) {
    return { text: "", error: "ANTHROPIC_API_KEY is not set" };
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 16384,
        system: "You are a shot list generator for an indie film production app. Return ONLY valid JSON as specified in the user prompt. No markdown, no explanation, no code fences — just the JSON object.",
        messages: [{ role: "user", content: prompt }]
      },
      {
        signal,
        timeout: GENERATION_TIMEOUT_MS
      }
    );

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("");

    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("API error during shot list generation", { error: message });
    return { text: "", error: message };
  }
}
