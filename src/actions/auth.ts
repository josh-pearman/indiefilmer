"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { loginSchema } from "@/lib/validators";
import { setSessionCookie, getAuthMode, getPerformedBy } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export type LoginState = {
  error?: string;
};

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  // Rate limit: 5 attempts per 15 minutes per IP
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  const limit = rateLimit(`login:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!limit.allowed) {
    return { error: "Too many login attempts. Please try again in 15 minutes." };
  }

  if (getAuthMode() !== "password") {
    return { error: "Password login is not enabled. Use email login." };
  }

  const rawUsername = formData.get("username");
  const rawPassword = formData.get("password");

  const parsed = loginSchema.safeParse({
    username: typeof rawUsername === "string" ? rawUsername.trim() : "",
    password: typeof rawPassword === "string" ? rawPassword : ""
  });

  if (!parsed.success) {
    return {
      error: parsed.error.errors[0]?.message ?? "Invalid input"
    };
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { username: username.toLowerCase(), approved: true },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    return { error: "User not found or not approved." };
  }

  if (!user.passwordHash) {
    return { error: "This account uses email login. Use the email form." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Incorrect password." };
  }

  await setSessionCookie(user.id);
  const performedBy = await getPerformedBy();
  await logAudit({
    action: "create",
    entityType: "Session",
    entityId: user.id,
    changeNote: "User logged in",
    performedBy
  });
  redirect("/");
}

export async function logout(): Promise<never> {
  const { clearSessionCookie } = await import("@/lib/auth");
  await clearSessionCookie();
  redirect("/login");
}
