import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { sendLoginCode } from "@/lib/email";
import { getAuthMode } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, CODE_EXPIRY_MINUTES } from "@/lib/constants";

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per 15 minutes per IP
  const ip = getClientIp(request);
  const limit = rateLimit(`send-code:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) },
      }
    );
  }

  if (getAuthMode() !== "email") {
    return NextResponse.json(
      { error: "Email login is not enabled." },
      { status: 400 }
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.approved) {
    return NextResponse.json(
      { error: "This email is not on the approved list. Email josh@indiefilmer.win to request access." },
      { status: 403 }
    );
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  await prisma.loginCode.create({
    data: { email, code, expiresAt }
  });

  try {
    await sendLoginCode(email, code);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send code" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
