"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser, getAuthMode, clearSessionCookie, getPerformedBy } from "@/lib/auth";
import { clearCurrentProject } from "@/lib/project";
import { logAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { changePasswordSchema } from "@/lib/validators";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

import { ActionResult as BaseActionResult } from "@/lib/action-result";
export type ActionResult = BaseActionResult & { success?: boolean };
export type DeleteAccountResult = { error?: string };

/**
 * Self-service account deletion.
 *
 * Requires the user to type "DELETE" to confirm.
 * Cascades: ProjectMember rows are deleted (Prisma onDelete: Cascade).
 * Projects where the user is the sole admin are NOT deleted — they become
 * orphaned and can be cleaned up by a superadmin. This prevents accidental
 * data loss for collaborators.
 */
export async function deleteMyAccount(
  confirmation: string
): Promise<DeleteAccountResult> {
  if (confirmation !== "DELETE") {
    return { error: 'Please type "DELETE" to confirm.' };
  }

  const userId = await getSessionUser();
  if (!userId) {
    return { error: "Not logged in." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, siteRole: true, email: true, username: true }
  });
  if (!user) {
    return { error: "User not found." };
  }

  // Prevent superadmin from deleting themselves (would lock out the system)
  if (user.siteRole === "superadmin") {
    return { error: "Superadmin accounts cannot be self-deleted. Contact another admin." };
  }

  const performedBy = await getPerformedBy();

  await logAudit({
    action: "delete",
    entityType: "User",
    entityId: userId,
    changeNote: "User deleted their own account",
    performedBy
  });

  // Delete user (cascades to ProjectMember via Prisma schema)
  await prisma.user.delete({ where: { id: userId } });

  // Clear session
  await clearSessionCookie();
  await clearCurrentProject();

  redirect("/login");
}

export async function changePassword(
  formData: FormData
): Promise<ActionResult> {
  const authMode = getAuthMode();
  if (authMode !== "password") {
    return { error: "Password changes are not available in this auth mode." };
  }

  const userId = await getSessionUser();
  if (!userId) {
    return { error: "Not logged in." };
  }

  const rl = rateLimit(`change-pw:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${rl.retryAfterSeconds} seconds.` };
  }

  const raw = {
    currentPassword: formData.get("currentPassword") as string,
    newPassword: formData.get("newPassword") as string,
    confirmPassword: formData.get("confirmPassword") as string
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true }
  });
  if (!user || !user.passwordHash) {
    return { error: "User not found or no password set." };
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { error: "New password must be different from current password." };
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newHash }
  });

  await logAudit({
    action: "update",
    entityType: "User",
    entityId: userId,
    changeNote: "Password changed",
    performedBy: await getPerformedBy()
  });

  return { success: true };
}
