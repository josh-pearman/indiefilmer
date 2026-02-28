"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess, getProjectRole } from "@/lib/project";
import { SECTION_KEYS } from "@/lib/sections";
import { sendInviteEmail } from "@/lib/email";

export type InviteState = { error?: string; success?: string };

const INVITE_EXPIRY_DAYS = 7;

async function requireProjectAdmin(): Promise<string> {
  await requireSectionAccess("settings");
  const userId = await getSessionUser();
  if (!userId) throw new Error("You must be logged in.");
  const projectId = await requireCurrentProjectId();
  const role = await getProjectRole(userId, projectId);
  if (role !== "admin") {
    throw new Error("Only project admins can manage invites.");
  }
  return projectId;
}

export async function createInvite(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  try {
    const projectId = await requireProjectAdmin();
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const role = (formData.get("role") as string)?.trim() || "collaborator";

    if (!email) return { error: "Email is required." };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: "Please enter a valid email address." };
    }
    if (role !== "admin" && role !== "collaborator") {
      return { error: "Role must be admin or collaborator." };
    }

    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: existingUser.id, projectId } }
      });
      if (existingMember) {
        return { error: "This user is already a member of the project." };
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: { projectId, email, accepted: false, expiresAt: { gt: new Date() } }
    });
    if (existingInvite) {
      return { error: "A pending invite already exists for this email." };
    }

    // Build sections
    const sections: string[] = role === "admin"
      ? []
      : SECTION_KEYS.filter((s) => s !== "settings" && formData.get(`section-${s}`) === "on");
    if (role === "collaborator" && sections.length === 0) {
      return { error: "Select at least one section for collaborators." };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        projectId,
        email,
        token,
        role,
        allowedSections: JSON.stringify(sections),
        expiresAt
      }
    });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true }
    });
    const inviterName = await getPerformedBy();

    await sendInviteEmail(
      email,
      project?.name ?? "Untitled Project",
      token,
      inviterName
    );

    await logAudit({
      action: "create",
      entityType: "Invite",
      entityId: invite.id,
      changeNote: `Invited ${email} as ${role}`,
      performedBy: inviterName,
      projectId
    });

    revalidatePath("/settings/people");
    return { success: `Invite sent to ${email}.` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send invite." };
  }
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      project: { select: { name: true } }
    }
  });
  if (!invite) return null;
  return {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    projectName: invite.project.name,
    expiresAt: invite.expiresAt,
    accepted: invite.accepted,
    expired: invite.expiresAt < new Date()
  };
}

export async function acceptInvite(token: string): Promise<InviteState> {
  try {
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { project: { select: { name: true } } }
    });

    if (!invite) return { error: "Invite not found." };
    if (invite.accepted) return { error: "This invite has already been accepted." };
    if (invite.expiresAt < new Date()) return { error: "This invite has expired." };

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: invite.email,
          approved: true
        }
      });
    } else if (!user.approved) {
      await prisma.user.update({
        where: { id: user.id },
        data: { approved: true }
      });
    }

    // Guard against race condition
    const existingMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId: invite.projectId } }
    });

    if (!existingMember) {
      await prisma.projectMember.create({
        data: {
          userId: user.id,
          projectId: invite.projectId,
          role: invite.role,
          allowedSections: invite.allowedSections
        }
      });
    }

    await prisma.invite.update({
      where: { id: invite.id },
      data: { accepted: true }
    });

    // Set session so the user is logged in
    const { setSessionCookie } = await import("@/lib/auth");
    await setSessionCookie(user.id);

    await logAudit({
      action: "create",
      entityType: "ProjectMember",
      entityId: user.id,
      changeNote: `Accepted invite as ${invite.role}`,
      performedBy: user.email ?? "system",
      projectId: invite.projectId
    });

    return { success: "Invite accepted! Redirecting to project..." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to accept invite." };
  }
}

export async function listPendingInvites() {
  const projectId = await requireProjectAdmin();
  return prisma.invite.findMany({
    where: { projectId, accepted: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true
    }
  });
}

export async function revokeInvite(inviteId: string): Promise<InviteState> {
  try {
    const projectId = await requireProjectAdmin();
    const invite = await prisma.invite.findFirst({
      where: { id: inviteId, projectId, accepted: false }
    });
    if (!invite) return { error: "Invite not found." };

    await prisma.invite.delete({ where: { id: inviteId } });

    await logAudit({
      action: "delete",
      entityType: "Invite",
      entityId: inviteId,
      changeNote: `Revoked invite for ${invite.email}`,
      performedBy: await getPerformedBy(),
      projectId
    });

    revalidatePath("/settings/people");
    return { success: "Invite revoked." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to revoke invite." };
  }
}
