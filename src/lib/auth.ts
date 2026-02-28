import { cookies } from "next/headers";
import { prisma } from "./db";

export const COOKIE_NAME = "indiefilmer-session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days in seconds

export type AuthMode = "password" | "email";

/** Reads AUTH_MODE from env. Defaults to "password" if unset. */
export function getAuthMode(): AuthMode {
  const mode = process.env.AUTH_MODE;
  if (mode === "email") return "email";
  return "password";
}

/** Set the session cookie after successful login (value = user id). */
export async function setSessionCookie(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/"
  });
}

/** Get the currently logged-in user ID from the cookie, or null. */
export async function getSessionUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE_NAME);
  const value = session?.value ?? null;
  if (!value) return null;
  const user = await prisma.user.findUnique({
    where: { id: value },
    select: { id: true }
  });
  return user?.id ?? null;
}

/** Get the display name for the logged-in user. */
export async function getSessionDisplayName(): Promise<string | null> {
  const userId = await getSessionUser();
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true }
  });
  return user?.name ?? user?.username ?? null;
}

/** Clear the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Use this in Server Actions to get the performedBy value for audit logging.
 * Returns the logged-in user's name or username, or "system" if not logged in.
 */
export async function getPerformedBy(): Promise<string> {
  const userId = await getSessionUser();
  if (!userId) return "system";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true }
  });
  return user?.name ?? user?.username ?? "system";
}

/** For middleware: check if cookie value is a valid user ID in the DB. */
export async function isRequestAuthenticated(
  cookieValue: string | undefined
): Promise<boolean> {
  if (!cookieValue?.trim()) return false;
  const user = await prisma.user.findUnique({
    where: { id: cookieValue },
    select: { id: true }
  });
  return !!user;
}

/** Check if the user with this cookie is approved (for redirect to /pending). */
export async function isSessionUserApproved(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue?.trim()) return false;
  const user = await prisma.user.findUnique({
    where: { id: cookieValue },
    select: { approved: true }
  });
  return user?.approved ?? false;
}

