/**
 * Prisma provider switcher.
 *
 * Auto-detects the correct provider from DATABASE_URL:
 *   - Starts with "postgresql://" or "postgres://" → postgresql
 *   - Everything else (including "file:...") → sqlite
 *
 * Can be overridden with DATABASE_PROVIDER env var.
 *
 * Runs automatically before `npm run build` via the prebuild hook.
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../.env") });

const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

function detectProvider(): "sqlite" | "postgresql" {
  const explicit = process.env.DATABASE_PROVIDER?.toLowerCase();
  if (explicit === "sqlite" || explicit === "postgresql") return explicit;

  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    return "postgresql";
  }
  return "sqlite";
}

const provider = detectProvider();

const schema = readFileSync(SCHEMA_PATH, "utf-8");

const updated = schema.replace(
  /datasource db \{[^}]+\}/,
  `datasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}`
);

writeFileSync(SCHEMA_PATH, updated);
console.log(`Prisma schema: provider = ${provider}`);
