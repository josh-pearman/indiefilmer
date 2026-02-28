"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireSectionAccess, requireCurrentProjectId } from "@/lib/project";

export interface TaskCandidate {
  title: string;
  sourceEntityType: string;
  sourceEntityId: string;
  linkLabel: string;
  linkUrl: string;
}

/**
 * Scan the project for gaps and return candidates (without creating anything).
 */
export async function scanForTaskCandidates(): Promise<{
  candidates: TaskCandidate[];
  skipped: number;
}> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const [
    uncastMembers,
    unconfirmedCrew,
    unlocatedScenes,
    addresslessLocations,
    existingTasks,
  ] = await Promise.all([
    prisma.castMember.findMany({
      where: {
        projectId,
        isDeleted: false,
        OR: [{ actorName: null }, { actorName: "" }],
      },
      select: { id: true, name: true },
    }),
    prisma.crewMember.findMany({
      where: {
        projectId,
        isDeleted: false,
        NOT: { status: "Confirmed" },
      },
      select: { id: true, name: true, position: true },
    }),
    prisma.scene.findMany({
      where: {
        projectId,
        isDeleted: false,
        locationId: null,
      },
      select: { id: true, sceneNumber: true },
    }),
    prisma.location.findMany({
      where: {
        projectId,
        isDeleted: false,
        OR: [{ address: null }, { address: "" }],
      },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: { projectId, isDeleted: false },
      select: { sourceEntityType: true, sourceEntityId: true },
    }),
  ]);

  const existingEntityKeys = new Set(
    existingTasks
      .filter((t) => t.sourceEntityType && t.sourceEntityId)
      .map((t) => `${t.sourceEntityType}:${t.sourceEntityId}`)
  );

  const allCandidates: TaskCandidate[] = [];

  for (const cm of uncastMembers) {
    allCandidates.push({
      title: `Cast ${cm.name}`,
      sourceEntityType: "CastMember",
      sourceEntityId: cm.id,
      linkLabel: cm.name,
      linkUrl: `/talent/cast/${cm.id}`,
    });
  }

  for (const cr of unconfirmedCrew) {
    allCandidates.push({
      title: `Hire ${cr.position}`,
      sourceEntityType: "CrewMember",
      sourceEntityId: cr.id,
      linkLabel: cr.name || cr.position,
      linkUrl: `/talent/crew/${cr.id}`,
    });
  }

  for (const sc of unlocatedScenes) {
    allCandidates.push({
      title: `Find a location for Scene ${sc.sceneNumber}`,
      sourceEntityType: "Scene",
      sourceEntityId: sc.id,
      linkLabel: `Scene ${sc.sceneNumber}`,
      linkUrl: `/script/scenes/${sc.id}`,
    });
  }

  for (const loc of addresslessLocations) {
    allCandidates.push({
      title: `Find location for ${loc.name}`,
      sourceEntityType: "Location",
      sourceEntityId: loc.id,
      linkLabel: loc.name,
      linkUrl: `/production/locations/${loc.id}`,
    });
  }

  const candidates = allCandidates.filter(
    (c) => !existingEntityKeys.has(`${c.sourceEntityType}:${c.sourceEntityId}`)
  );
  const skipped = allCandidates.length - candidates.length;

  return { candidates, skipped };
}

/**
 * Create a single task from a candidate. Called per-item for progress tracking.
 */
export async function createTaskFromCandidate(
  candidate: TaskCandidate
): Promise<void> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const performedBy = await getPerformedBy();

  const task = await prisma.task.create({
    data: {
      projectId,
      title: candidate.title,
      owner: null,
      status: "Todo",
      sourceEntityType: candidate.sourceEntityType,
      sourceEntityId: candidate.sourceEntityId,
    },
  });

  await prisma.taskLink.create({
    data: {
      taskId: task.id,
      label: candidate.linkLabel,
      url: candidate.linkUrl,
    },
  });

  await logAudit({
    action: "create",
    entityType: "Task",
    entityId: task.id,
    after: { title: task.title, owner: null, status: "Todo" },
    changeNote: "Auto-generated major task",
    performedBy,
  });
}

/**
 * Revalidate paths after all tasks are created.
 */
export async function finishTaskGeneration(): Promise<void> {
  await requireSectionAccess("settings");
  revalidatePath("/production/tasks");
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteUnassignedTasks(): Promise<{ deleted: number }> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const tasks = await prisma.task.findMany({
    where: { projectId, owner: null, isDeleted: false },
    select: { id: true, title: true },
  });

  if (tasks.length === 0) return { deleted: 0 };

  const taskIds = tasks.map((t) => t.id);
  const performedBy = await getPerformedBy();

  // Delete associated links and files first
  await prisma.taskLink.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.taskFile.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });

  for (const task of tasks) {
    await logAudit({
      action: "delete",
      entityType: "Task",
      entityId: task.id,
      before: { title: task.title },
      changeNote: "Bulk delete unassigned task",
      performedBy,
    });
  }

  revalidatePath("/production/tasks");
  revalidatePath("/settings");
  revalidatePath("/");

  return { deleted: tasks.length };
}
