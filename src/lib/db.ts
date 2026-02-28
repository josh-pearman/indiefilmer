import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaInitialized?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Enable WAL mode and busy_timeout for SQLite multi-user concurrency.
// WAL allows concurrent readers during writes; busy_timeout retries on lock
// contention instead of failing immediately with SQLITE_BUSY.
// Deferred to avoid running in Edge Runtime (middleware imports this module).
export async function ensureSqlitePragmas(): Promise<void> {
  if (globalForPrisma.prismaInitialized) return;
  if (!process.env.DATABASE_URL?.startsWith("file:")) return;
  globalForPrisma.prismaInitialized = true;
  await prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL").catch(() => {});
  await prisma.$executeRawUnsafe("PRAGMA busy_timeout=5000").catch(() => {});
}

