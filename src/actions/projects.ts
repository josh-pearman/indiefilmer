"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { rm } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  setCurrentProject,
  setProjectMemberCookie,
  clearCurrentProject,
  getProjectRole,
  requireCurrentProjectId,
} from "@/lib/project";

const BUCKET_NAMES = [
  "Locations",
  "Food",
  "Gear",
  "Talent",
  "Crew",
  "Transport",
  "Post",
  "Misc"
];

export type CreateProjectState = { error?: string };

export async function listProjects() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const members = await prisma.projectMember.findMany({
    where: { userId },
    include: {
      project: {
        select: { id: true, name: true }
      }
    }
  });
  return members.map((m) => ({
    id: m.project.id,
    name: m.project.name
  }));
}

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData
): Promise<CreateProjectState> {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const name = (formData.get("name") as string)?.trim() || "Untitled Project";

  const project = await prisma.project.create({
    data: { name }
  });

  await prisma.projectMember.create({
    data: {
      userId,
      projectId: project.id,
      role: "admin"
    }
  });

  await prisma.projectSettings.create({
    data: {
      projectId: project.id,
      projectName: name
    }
  });

  for (const bucketName of BUCKET_NAMES) {
    await prisma.budgetBucket.create({
      data: {
        projectId: project.id,
        name: bucketName,
        plannedAmount: 0
      }
    });
  }

  await setCurrentProject(project.id);
  await setProjectMemberCookie(project.id, userId);
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/");
}

export async function selectProjectForm(formData: FormData): Promise<never> {
  const projectId = (formData.get("projectId") as string)?.trim();
  if (!projectId) redirect("/projects");
  return selectProject(projectId);
}

export async function selectProject(projectId: string): Promise<never> {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } }
  });
  if (!member) redirect("/projects");

  await setCurrentProject(projectId);
  await setProjectMemberCookie(projectId, userId);
  revalidatePath("/");
  redirect("/");
}

export type DeleteProjectResult = { error?: string };

/**
 * Permanently delete a project and all its data.
 *
 * Requires:
 * - User must be an admin of the project
 * - User must type the exact project name to confirm
 *
 * Deletes:
 * - All database rows (Prisma cascade handles child records)
 * - All uploaded files (data/uploads/{projectId}/)
 * - All backups (data/backups/{projectId}/)
 * - Clears the project cookie if this was the active project
 */
export async function deleteProject(
  confirmationName: string
): Promise<DeleteProjectResult> {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const projectId = await requireCurrentProjectId();
  const role = await getProjectRole(userId, projectId);
  if (role !== "admin") {
    return { error: "Only project admins can delete a project." };
  }

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
    select: { projectName: true }
  });
  const projectName = settings?.projectName ?? "Untitled Project";

  if (confirmationName.trim() !== projectName.trim()) {
    return { error: "Confirmation text does not match project name." };
  }

  const performedBy = await getPerformedBy();
  await logAudit({
    action: "delete",
    entityType: "Project",
    entityId: projectId,
    changeNote: `Project "${projectName}" permanently deleted`,
    performedBy
  });

  // Delete the project row — Prisma cascade removes all child records
  await prisma.project.delete({ where: { id: projectId } });

  // Clean up files on disk
  const projectRoot = process.cwd();
  const uploadsDir = path.join(projectRoot, "data", "uploads", projectId);
  const backupsDir = path.join(projectRoot, "data", "backups", projectId);

  try {
    await rm(uploadsDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }
  try {
    await rm(backupsDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }

  // Clear the active project cookie
  await clearCurrentProject();

  revalidatePath("/", "layout");
  redirect("/projects");
}
