/**
 * Prisma provider switcher.
 *
 * Reads DATABASE_PROVIDER env var (default: "sqlite") and patches
 * prisma/schema.prisma to use the correct provider and URL before
 * running `prisma generate` or `prisma migrate`.
 *
 * Usage:
 *   DATABASE_PROVIDER=postgresql tsx scripts/prisma-provider.ts
 *   npx prisma generate
 *
 * This is a build-time concern — the Dockerfile for the subscription
 * service runs this before `prisma generate && npm run build`.
 */

import { readFileSync, writeFileSync } from "fs";
import path from "path";

const SCHEMA_PATH = path.resolve(__dirname, "../prisma/schema.prisma");

const provider = (process.env.DATABASE_PROVIDER ?? "sqlite").toLowerCase();

if (provider !== "sqlite" && provider !== "postgresql") {
  console.error(`Invalid DATABASE_PROVIDER: "${provider}". Must be "sqlite" or "postgresql".`);
  process.exit(1);
}

const schema = readFileSync(SCHEMA_PATH, "utf-8");

let updated: string;
if (provider === "postgresql") {
  updated = schema.replace(
    /datasource db \{[^}]+\}/,
    `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`
  );
  console.log("Prisma schema patched: provider = postgresql, url = env(DATABASE_URL)");
} else {
  updated = schema.replace(
    /datasource db \{[^}]+\}/,
    `datasource db {\n  provider = "sqlite"\n  url      = env("DATABASE_URL")\n}`
  );
  console.log("Prisma schema patched: provider = sqlite, url = env(DATABASE_URL)");
}

writeFileSync(SCHEMA_PATH, updated);
