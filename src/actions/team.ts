"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { z } from "zod";
import { passwordSchema } from "@/lib/validators";

const addMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(1, "Username is required").regex(/^[a-z0-9_-]+$/i, "Username can only use letters, numbers, _ and -"),
  password: passwordSchema,
  siteRole: z.enum(["user", "superadmin"])
});

const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  newPassword: passwordSchema
});

export type TeamState = { error?: string; success?: string };

async function requireSuperadmin() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { siteRole: true }
  });
  if (user?.siteRole !== "superadmin") {
    redirect("/settings");
  }
  return userId;
}

export async function addMember(
  _prevState: TeamState,
  formData: FormData
): Promise<TeamState> {
  await requireSuperadmin();

  const parsed = addMemberSchema.safeParse({
    name: formData.get("name"),
    username: (formData.get("username") as string)?.trim().toLowerCase(),
    password: formData.get("password"),
    siteRole: formData.get("siteRole") || "user"
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { name, username, password, siteRole } = parsed.data;

  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) {
    return { error: "Username is already taken." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, username, passwordHash, approved: true, siteRole }
  });

  await logAudit({
    action: "create",
    entityType: "User",
    entityId: user.id,
    changeNote: `Team member ${username} added`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/settings/people");
  return { success: `${name} has been added. They can log in with that username and password.` };
}

export async function resetMemberPassword(
  _prevState: TeamState,
  formData: FormData
): Promise<TeamState> {
  await requireSuperadmin();

  const parsed = resetPasswordSchema.safeParse({
    userId: formData.get("userId"),
    newPassword: formData.get("newPassword")
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const { userId, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true }
  });
  if (!user) {
    return { error: "User not found." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  await logAudit({
    action: "update",
    entityType: "User",
    entityId: userId,
    changeNote: "Password reset",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/settings/people");
  return { success: "Password has been reset." };
}

export async function removeMember(userId: string): Promise<TeamState> {
  await requireSuperadmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, siteRole: true }
  });
  if (!user) {
    return { error: "User not found." };
  }
  if (user.siteRole === "superadmin") {
    return { error: "Cannot remove the last superadmin." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { approved: false }
  });

  await logAudit({
    action: "update",
    entityType: "User",
    entityId: userId,
    changeNote: "Member removed (deactivated)",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/settings/people");
  return { success: "Member has been removed. They can no longer log in." };
}

export async function listTeamMembers() {
  await requireSuperadmin();

  return prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      approved: true,
      siteRole: true,
      createdAt: true
    }
  });
}
