"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

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

export async function listPendingUsers() {
  await requireSuperadmin();
  return prisma.user.findMany({
    where: { approved: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      createdAt: true
    }
  });
}

export async function approveUser(userId: string): Promise<{ error?: string }> {
  await requireSuperadmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true }
  });
  if (!user) return { error: "User not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { approved: true }
  });

  await logAudit({
    action: "update",
    entityType: "User",
    entityId: userId,
    changeNote: "User approved",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/admin");
  return {};
}

export async function preApproveEmail(email: string): Promise<{ error?: string }> {
  await requireSuperadmin();

  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  const existing = await prisma.user.findUnique({ where: { email: trimmed } });
  if (existing) {
    if (existing.approved) return { error: "This email is already approved." };
    await prisma.user.update({
      where: { id: existing.id },
      data: { approved: true }
    });
  } else {
    await prisma.user.create({
      data: { email: trimmed, approved: true }
    });
  }

  await logAudit({
    action: "create",
    entityType: "User",
    entityId: trimmed,
    changeNote: "Email pre-approved for access",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/admin");
  return {};
}

export async function rejectUser(userId: string): Promise<{ error?: string }> {
  await requireSuperadmin();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });
  if (!user) return { error: "User not found." };

  await prisma.user.delete({ where: { id: userId } });

  await logAudit({
    action: "delete",
    entityType: "User",
    entityId: userId,
    changeNote: "User rejected (deleted)",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/admin");
  return {};
}
