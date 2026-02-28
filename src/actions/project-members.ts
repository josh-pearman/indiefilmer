"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import {
  requireCurrentProjectId,
  requireSectionAccess,
  getProjectRole,
  setProjectMemberCookie
} from "@/lib/project";
import { SECTION_KEYS, parseAllowedSections } from "@/lib/sections";

export type ProjectMembersState = { error?: string; success?: string };

async function requireProjectAdmin(): Promise<string> {
  await requireSectionAccess("settings");
  const userId = await getSessionUser();
  if (!userId) throw new Error("You must be logged in.");
  const projectId = await requireCurrentProjectId();
  const role = await getProjectRole(userId, projectId);
  if (role !== "admin") {
    throw new Error("Only project admins can manage collaborators.");
  }
  return projectId;
}

/** List users that can be added to the project (approved, not already members). */
export async function listUsersAvailableToAdd() {
  const projectId = await requireProjectAdmin();
  const existing = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true }
  });
  const existingIds = new Set(existing.map((m) => m.userId));
  const users = await prisma.user.findMany({
    where: { approved: true, id: { notIn: [...existingIds] } },
    select: { id: true, name: true, username: true, email: true }
  });
  return users;
}

export async function listProjectMembers() {
  const projectId = await requireProjectAdmin();
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, name: true, username: true, email: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    userName: m.user.name ?? m.user.username ?? m.user.email ?? "Unknown",
    username: m.user.username,
    email: m.user.email,
    role: m.role,
    allowedSections: parseAllowedSections(m.allowedSections)
  }));
}

export async function addProjectMember(
  _prev: ProjectMembersState,
  formData: FormData
): Promise<ProjectMembersState> {
  try {
    const projectId = await requireProjectAdmin();
    const userId = (formData.get("userId") as string)?.trim();
    const role = (formData.get("role") as string)?.trim() || "collaborator";
    if (!userId) return { error: "Select a user to add." };
    if (role !== "admin" && role !== "collaborator") {
      return { error: "Role must be admin or collaborator." };
    }

    const existing = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } }
    });
    if (existing) return { error: "This user is already a member of the project." };

    const sections: string[] = role === "admin" ? [] : SECTION_KEYS.filter((s) => formData.get(`section-${s}`) === "on");
    if (role === "collaborator" && sections.length === 0) {
      return { error: "Select at least one section for collaborators." };
    }

    await prisma.projectMember.create({
      data: {
        userId,
        projectId,
        role,
        allowedSections: JSON.stringify(sections)
      }
    });

    await logAudit({
      action: "create",
      entityType: "ProjectMember",
      entityId: userId,
      changeNote: `Added member with role ${role}`,
      performedBy: await getPerformedBy(),
      projectId
    });

    revalidatePath("/settings");
    revalidatePath("/settings/people");
    return { success: "Collaborator added." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to add member." };
  }
}

export async function updateProjectMemberSections(
  memberId: string,
  sections: string[]
): Promise<ProjectMembersState> {
  try {
    const projectId = await requireProjectAdmin();
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId }
    });
    if (!member) return { error: "Member not found." };
    if (member.role === "admin") return { error: "Admins have access to all sections." };

    const validSections = sections.filter((s) => SECTION_KEYS.includes(s as typeof SECTION_KEYS[number]));
    await prisma.projectMember.update({
      where: { id: memberId },
      data: { allowedSections: JSON.stringify(validSections) }
    });

    await logAudit({
      action: "update",
      entityType: "ProjectMember",
      entityId: memberId,
      changeNote: `Updated sections to ${validSections.join(", ") || "none"}`,
      performedBy: await getPerformedBy(),
      projectId
    });

    if (member.userId === (await getSessionUser())) {
      await setProjectMemberCookie(projectId, member.userId);
    }
    revalidatePath("/settings");
    revalidatePath("/settings/people");
    return { success: "Sections updated." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update sections." };
  }
}

export async function updateProjectMemberRole(
  memberId: string,
  role: "admin" | "collaborator"
): Promise<ProjectMembersState> {
  try {
    const projectId = await requireProjectAdmin();
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId }
    });
    if (!member) return { error: "Member not found." };

    await prisma.projectMember.update({
      where: { id: memberId },
      data: {
        role,
        allowedSections: role === "admin" ? "[]" : member.allowedSections
      }
    });

    await logAudit({
      action: "update",
      entityType: "ProjectMember",
      entityId: memberId,
      changeNote: `Role changed to ${role}`,
      performedBy: await getPerformedBy(),
      projectId
    });

    if (member.userId === (await getSessionUser())) {
      await setProjectMemberCookie(projectId, member.userId);
    }
    revalidatePath("/settings");
    revalidatePath("/settings/people");
    return { success: "Role updated." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to update role." };
  }
}

export async function removeProjectMember(memberId: string): Promise<ProjectMembersState> {
  try {
    const projectId = await requireProjectAdmin();
    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId }
    });
    if (!member) return { error: "Member not found." };

    await prisma.projectMember.delete({ where: { id: memberId } });

    await logAudit({
      action: "delete",
      entityType: "ProjectMember",
      entityId: memberId,
      changeNote: "Removed from project",
      performedBy: await getPerformedBy(),
      projectId
    });

    revalidatePath("/settings");
    revalidatePath("/settings/people");
    return { success: "Member removed from project." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to remove member." };
  }
}
