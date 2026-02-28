#!/usr/bin/env node
/**
 * Interactive setup for Film Planner (Phase 4).
 * Run: npm run setup
 */

import * as fs from "fs";
import * as path from "path";
import { execSync, spawnSync } from "child_process";
import { intro, outro, text, password, confirm, select, note, cancel } from "@clack/prompts";

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const DATA_DIR = path.join(ROOT, "data");

function nodeVersion(): number {
  const v = process.version.slice(1).split(".").map(Number);
  return (v[0] ?? 0) * 1000 + (v[1] ?? 0);
}

function hasClaudeCli(): boolean {
  const local = path.join(process.env.HOME ?? "", ".local", "bin", "claude");
  if (fs.existsSync(local)) return true;
  try {
    execSync("which claude", { encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function run(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true });
  return r.status === 0;
}

async function main(): Promise<void> {
  intro("Film Planner — Setup");

  if (nodeVersion() < 18_000) {
    note("Node 18+ is recommended. Continuing anyway.", "Node version");
  }

  note("Installing dependencies…", "Step 1");
  if (!run("npm", ["install"])) {
    cancel("npm install failed.");
    process.exit(1);
  }

  ensureDataDir();
  note("Running database migrations…", "Step 2");
  if (!run("npx", ["prisma", "migrate", "deploy"])) {
    cancel("Prisma migrate deploy failed.");
    process.exit(1);
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const userCount = await prisma.user.count();
  await prisma.$disconnect();

  if (userCount > 0) {
    note("Users already exist. Setup has already been completed.", "Already set up");
    outro("Exiting. Use the app to manage users.");
    process.exit(0);
  }

  const existingEnv = fs.existsSync(ENV_PATH);
  if (existingEnv) {
    const overwrite = await confirm({
      message: ".env already exists. Overwrite with new values?",
      initialValue: false
    });
    if (overwrite === false) {
      cancel("Setup cancelled.");
      process.exit(0);
    }
  }

  const name = await text({
    message: "Admin display name",
    placeholder: "Jane Doe",
    validate: (v) => (v != null && String(v).trim() ? undefined : "Required")
  });
  if (name === undefined) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  const username = await text({
    message: "Admin username (login)",
    placeholder: "jane",
    validate: (v) => {
      const s = (v != null ? String(v) : "").trim().toLowerCase();
      if (!s) return "Required";
      if (!/^[a-z0-9_-]+$/.test(s)) return "Only letters, numbers, _ and -";
      return undefined;
    }
  });
  if (username === undefined) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  const pw = await password({
    message: "Admin password",
    validate: (v) => {
      const s = v != null ? String(v) : "";
      if (s.length < 12) return "At least 12 characters";
      if (!/[a-z]/.test(s)) return "Must contain a lowercase letter";
      if (!/[A-Z]/.test(s)) return "Must contain an uppercase letter";
      if (!/[0-9]/.test(s)) return "Must contain a number";
      return undefined;
    }
  });
  if (pw === undefined) {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  const confirmPw = await password({
    message: "Confirm password"
  });
  if (confirmPw === undefined || confirmPw !== pw) {
    cancel("Passwords do not match.");
    process.exit(1);
  }

  const chatChoice = await select({
    message: "AI assistant",
    options: [
      { value: "cli", label: "Claude CLI (local binary at ~/.local/bin/claude)" },
      { value: "api", label: "Anthropic API key" },
      { value: "off", label: "None (disable chat)" }
    ]
  });
  if (chatChoice === undefined || typeof chatChoice !== "string") {
    cancel("Setup cancelled.");
    process.exit(0);
  }

  let chatMode: "cli" | "api" | "off" =
    chatChoice === "cli" || chatChoice === "api" || chatChoice === "off" ? chatChoice : "off";
  let anthropicKey = "";

  if (chatMode === "cli") {
    if (!hasClaudeCli()) {
      note(
        "Claude CLI not found. Install from https://claude.ai/download and ensure 'claude' is on your PATH (e.g. ~/.local/bin/claude).",
        "Claude CLI"
      );
      chatMode = "off";
    } else {
      note("Claude CLI found.", "Claude CLI");
    }
  } else if (chatMode === "api") {
    const key = await password({
      message: "Anthropic API key (sk-ant-...)",
      validate: (v) =>
        v != null && String(v).startsWith("sk-ant-") ? undefined : "Enter a valid API key"
    });
    if (key === undefined) {
      cancel("Setup cancelled.");
      process.exit(0);
    }
    anthropicKey = typeof key === "string" ? key : "";
  }

  const useMaps = await confirm({
    message: "Enable Google Maps (locations / call sheets)?",
    initialValue: false
  });
  let googleMapsKey = "";
  if (useMaps === true) {
    const key = await text({
      message: "Google Maps API key",
      placeholder: "AIza..."
    });
    if (key != null && typeof key === "string" && key.trim()) googleMapsKey = key.trim();
  }

  const useEmail = await confirm({
    message: "Enable email sending for intake forms? (requires a free Resend API key)",
    initialValue: false
  });
  let resendApiKey = "";
  let resendFromEmail = "";
  if (useEmail === true) {
    const apiKey = await password({
      message: "Resend API key (re_...)",
      validate: (v) =>
        v != null && String(v).startsWith("re_") ? undefined : "Enter a valid Resend API key (starts with re_)"
    });
    if (apiKey != null && typeof apiKey === "string" && apiKey.trim()) {
      resendApiKey = apiKey.trim();
    }
    if (resendApiKey) {
      const fromEmail = await text({
        message: "Sender email address (or press Enter for default)",
        placeholder: "hello@yourdomain.com"
      });
      if (fromEmail != null && typeof fromEmail === "string" && fromEmail.trim()) {
        resendFromEmail = fromEmail.trim();
      }
    }
  }

  const remoteAccess = await confirm({
    message: "Set up remote access (Cloudflare Tunnel)?",
    initialValue: false
  });
  if (remoteAccess === true) {
    note(
      `To set up remote access via Cloudflare Tunnel:

1. Install cloudflared:
   brew install cloudflared          # macOS
   # or see https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

2. Authenticate:
   cloudflared tunnel login

3. Create a tunnel:
   cloudflared tunnel create indiefilmer

4. Route your domain:
   cloudflared tunnel route dns indiefilmer your-domain.com

5. Run the tunnel:
   cloudflared tunnel run --url http://localhost:3001 indiefilmer

Your team can then access the app at https://your-domain.com`,
      "Cloudflare Tunnel"
    );
  }

  const envLines: string[] = [
    "# Generated by npm run setup",
    'DATABASE_URL="file:../data/db.sqlite"',
    "AUTH_MODE=password",
    `CHAT_MODE=${chatMode}`
  ];
  if (anthropicKey) envLines.push(`ANTHROPIC_API_KEY=${anthropicKey}`);
  if (googleMapsKey) envLines.push(`GOOGLE_MAPS_API_KEY=${googleMapsKey}`);
  if (resendApiKey) envLines.push(`RESEND_API_KEY=${resendApiKey}`);
  if (resendFromEmail) envLines.push(`RESEND_FROM_EMAIL=${resendFromEmail}`);
  envLines.push("");

  fs.writeFileSync(ENV_PATH, envLines.join("\n") + "\n", "utf8");
  note(".env written.", "Configuration");

  const { hashPassword } = await import("../src/lib/password");
  const passwordHash = await hashPassword(String(pw));
  const db = new PrismaClient();

  const user = await db.user.create({
    data: {
      name: String(name).trim(),
      username: String(username).trim().toLowerCase(),
      passwordHash,
      approved: true,
      siteRole: "superadmin"
    }
  });

  const project = await db.project.create({
    data: { name: "My First Project" }
  });

  await db.projectSettings.create({
    data: {
      projectId: project.id,
      projectName: project.name,
      totalBudget: 10000,
      currencySymbol: "$"
    }
  });

  await db.projectMember.create({
    data: {
      userId: user.id,
      projectId: project.id,
      role: "admin",
      allowedSections: "[]"
    }
  });

  const BUCKET_NAMES = [
    "Locations",
    "Food",
    "Gear",
    "Talent",
    "Crew",
    "Transport",
    "Post",
    "Misc"
  ];
  for (const bucketName of BUCKET_NAMES) {
    await db.budgetBucket.create({
      data: { projectId: project.id, name: bucketName, plannedAmount: 0 }
    });
  }

  await db.$disconnect();

  outro("Setup complete. Run: npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
