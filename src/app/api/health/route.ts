import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { statfs } from "fs/promises";
import path from "path";

const LOW_DISK_THRESHOLD_MB = 500;

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Database connectivity
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = "ok";
  } catch {
    checks.database = "unreachable";
    healthy = false;
  }

  // Disk space
  try {
    const dataDir = path.resolve(process.cwd(), "data");
    const stats = await statfs(dataDir);
    const freeMb = Math.round((stats.bfree * stats.bsize) / (1024 * 1024));
    checks.disk_free_mb = String(freeMb);
    if (freeMb < LOW_DISK_THRESHOLD_MB) {
      checks.disk_warning = `Free space below ${LOW_DISK_THRESHOLD_MB}MB`;
      healthy = false;
    }
  } catch {
    checks.disk = "unknown";
  }

  checks.uptime_seconds = String(Math.round(process.uptime()));

  const status = healthy ? 200 : 503;
  return NextResponse.json({ status: healthy ? "healthy" : "degraded", checks }, { status });
}
