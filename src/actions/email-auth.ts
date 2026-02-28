"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { setSessionCookie, getPerformedBy } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();

export type VerifyState = { error?: string };

export async function verifyCode(
  _prevState: VerifyState,
  formData: FormData
): Promise<VerifyState> {
  // Rate limit: 5 attempts per 15 minutes per IP
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  const limit = rateLimit(`verify-code:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return { error: "Too many attempts. Please try again in 15 minutes." };
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const code = (formData.get("code") as string)?.trim();

  if (!email || !code) {
    return { error: "Email and code are required." };
  }

  const loginCode = await prisma.loginCode.findFirst({
    where: { email, code, used: false, expiresAt: { gt: new Date() } }
  });

  if (!loginCode) {
    return { error: "Invalid or expired code. Request a new one." };
  }

  await prisma.loginCode.update({
    where: { id: loginCode.id },
    data: { used: true }
  });

  let user = await prisma.user.findUnique({
    where: { email }
  });

  const isSuperadminEmail = SUPERADMIN_EMAIL && email === SUPERADMIN_EMAIL;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        approved: !!isSuperadminEmail,
        siteRole: isSuperadminEmail ? "superadmin" : "user"
      }
    });
  } else if (isSuperadminEmail) {
    await prisma.user.update({
      where: { id: user.id },
      data: { approved: true, siteRole: "superadmin" }
    });
    user = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  }

  await setSessionCookie(user.id);
  await logAudit({
    action: "create",
    entityType: "Session",
    entityId: user.id,
    changeNote: "User logged in via email code",
    performedBy: await getPerformedBy()
  });

  if (user.approved) {
    redirect("/");
  }
  redirect("/pending");
}
