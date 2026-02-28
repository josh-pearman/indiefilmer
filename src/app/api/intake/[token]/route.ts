import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

function getClientIp(headersList: Headers): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rl = rateLimit(`intake:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 60) },
      }
    );
  }

  const { token } = await params;

  const [castMember, crewMember] = await Promise.all([
    prisma.castMember.findUnique({ where: { intakeToken: token } }),
    prisma.crewMember.findUnique({ where: { intakeToken: token } }),
  ]);

  const record = castMember ?? crewMember;
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Check token expiry
  if (record.intakeTokenExpiresAt && new Date(record.intakeTokenExpiresAt) < new Date()) {
    return NextResponse.json({ error: "This intake link has expired." }, { status: 410 });
  }

  const isCast = !!castMember;
  const displayName = isCast ? (castMember.actorName ?? "") : crewMember!.name;

  return NextResponse.json({
    name: displayName,
    phone: record.phone ?? "",
    email: record.email ?? "",
    emergencyContactName: record.emergencyContactName ?? "",
    emergencyContactPhone: record.emergencyContactPhone ?? "",
    emergencyContactRelation: record.emergencyContactRelation ?? "",
    dietaryRestrictions: record.dietaryRestrictions ?? "",
    includePhoneOnCallSheet: record.includePhoneOnCallSheet,
    includeEmailOnCallSheet: record.includeEmailOnCallSheet,
  });
}
