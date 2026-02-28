"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  getScenesForLocation,
  getSceneScheduleStatus,
  getShootDayNumberMap
} from "@/lib/schedule";
import {
  createShootDaySchema,
  updateShootDaySchema,
  assignScenesToDaySchema,
  assignCrewToDaySchema,
  reorderDayScenesSchema
} from "@/lib/validators";

export type CreateShootDayState = { error?: string };
export type UpdateShootDayState = { error?: string };
export type AssignScenesState = { error?: string };

export async function createShootDay(
  _prev: CreateShootDayState,
  formData: FormData
): Promise<CreateShootDayState> {
  await requireSectionAccess("schedule");
  const raw = {
    date: formData.get("date"),
    callTime: formData.get("callTime") ?? undefined,
    locationId: formData.get("locationId") || undefined,
    status: formData.get("status") ?? "Planned",
    notes: (formData.get("notes") as string) || undefined,
    sceneIds: formData.getAll("sceneIds") as string[],
    meals: formData.get("meals") ? Number(formData.get("meals")) : undefined,
    transport: formData.get("transport")
      ? Number(formData.get("transport"))
      : undefined,
    misc: formData.get("misc") ? Number(formData.get("misc")) : undefined
  };

  const parsed = createShootDaySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const date = new Date(data.date);
  const projectId = await requireCurrentProjectId();

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId }
  });
  const craftyEnabled = settings?.craftyEnabledByDefault ?? true;
  const lunchEnabled = settings?.lunchEnabledByDefault ?? true;
  const dinnerEnabled = settings?.dinnerEnabledByDefault ?? false;

  const shootDay = await prisma.$transaction(async (tx) => {
    const day = await tx.shootDay.create({
      data: {
        projectId,
        date,
        callTime: data.callTime ?? null,
        locationId: data.locationId ?? null,
        status: data.status,
        notes: data.notes ?? null,
        meals: data.meals ?? null,
        transport: data.transport ?? null,
        misc: data.misc ?? null,
        budgetBucket: "Transport"
      }
    });

    await tx.shootDayMeal.createMany({
      data: [
        { shootDayId: day.id, mealType: "crafty", enabled: craftyEnabled },
        { shootDayId: day.id, mealType: "lunch", enabled: lunchEnabled },
        { shootDayId: day.id, mealType: "dinner", enabled: dinnerEnabled }
      ]
    });

    if (data.sceneIds?.length) {
      await tx.shootDayScene.createMany({
        data: data.sceneIds.map((sceneId, index) => ({
          shootDayId: day.id,
          sceneId,
          sortOrder: index
        }))
      });
    }

    return day;
  });

  // Link a standalone catering day if requested
  const linkCateringDayId = (formData.get("linkCateringDayId") as string) || "";
  if (linkCateringDayId) {
    const cateringDay = await prisma.cateringDay.findUnique({
      where: { id: linkCateringDayId }
    });
    if (cateringDay && cateringDay.projectId === projectId && !cateringDay.shootDayId) {
      await prisma.cateringDay.update({
        where: { id: linkCateringDayId },
        data: { shootDayId: shootDay.id }
      });
    }
  }

  // Eagerly create a placeholder call sheet so the page doesn't 404
  // if the user navigates before Next.js cache revalidation completes.
  // getOrCreateCallSheet will detect the unpopulated record and enrich it.
  await prisma.callSheet.upsert({
    where: { shootDayId: shootDay.id },
    create: { shootDayId: shootDay.id },
    update: {}
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "ShootDay",
    entityId: shootDay.id,
    after: shootDay,
    changeNote: `Shoot day ${date.toISOString().slice(0, 10)} created`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${shootDay.id}`);
  revalidatePath(`/production/schedule/${shootDay.id}/call-sheet`);
  revalidatePath("/production/catering");
  revalidatePath("/production/gear");
  revalidatePath("/");
  return {};
}

export async function updateShootDay(
  id: string,
  formData: FormData
): Promise<UpdateShootDayState> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.shootDay.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Shoot day not found" };

  const raw = {
    id,
    date: formData.get("date"),
    callTime: formData.get("callTime") ?? undefined,
    locationId: formData.get("locationId") || undefined,
    status: (formData.get("status") as string)?.trim() || undefined,
    notes: (formData.get("notes") as string | null) ?? undefined,
    meals: formData.get("meals") ? Number(formData.get("meals")) : undefined,
    transport: formData.get("transport")
      ? Number(formData.get("transport"))
      : undefined,
    misc: formData.get("misc") ? Number(formData.get("misc")) : undefined
  };

  const parsed = updateShootDaySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const updatePayload: Parameters<typeof prisma.shootDay.update>[0]["data"] = {};
  if (data.date !== undefined) updatePayload.date = new Date(data.date);
  if (data.callTime !== undefined) updatePayload.callTime = data.callTime;
  if (data.locationId !== undefined)
    updatePayload.locationId = data.locationId || null;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.notes !== undefined) updatePayload.notes = data.notes || null;
  if (data.meals !== undefined) updatePayload.meals = data.meals;
  if (data.transport !== undefined) updatePayload.transport = data.transport;
  if (data.misc !== undefined) updatePayload.misc = data.misc;

  const afterRecord = await prisma.shootDay.update({
    where: { id },
    data: updatePayload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "ShootDay",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${id}`);
  revalidatePath(`/production/schedule/${id}/call-sheet`);
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export async function deleteShootDay(id: string): Promise<{ error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.shootDay.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Shoot day not found" };

  await prisma.shootDay.update({
    where: { id },
    data: { isDeleted: true }
  });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "ShootDay",
    entityId: id,
    before,
    changeNote: "Shoot day soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${id}`);
  revalidatePath("/production/catering");
  revalidatePath("/production/gear");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function restoreShootDay(id: string): Promise<{ error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.shootDay.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Shoot day not found" };
  if (!before.isDeleted) return { error: "Shoot day is not deleted" };

  const after = await prisma.shootDay.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "ShootDay",
    entityId: id,
    before,
    after,
    changeNote: "Shoot day restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${id}`);
  revalidatePath("/production/catering");
  revalidatePath("/production/gear");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function assignScenesToDay(
  shootDayId: string,
  sceneIds: string[]
): Promise<AssignScenesState> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const parsed = assignScenesToDaySchema.safeParse({
    shootDayId,
    sceneIds
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const day = await prisma.shootDay.findUnique({
    where: { id: shootDayId },
    include: { scenes: true }
  });
  if (!day || day.projectId !== projectId) return { error: "Shoot day not found" };
  const validSceneCount = await prisma.scene.count({
    where: { id: { in: sceneIds }, projectId, isDeleted: false }
  });
  if (validSceneCount !== sceneIds.length) return { error: "One or more scenes are invalid for this project" };

  await prisma.shootDayScene.deleteMany({ where: { shootDayId } });

  if (sceneIds.length > 0) {
    await prisma.shootDayScene.createMany({
      data: sceneIds.map((sceneId, index) => ({
        shootDayId,
        sceneId,
        sortOrder: index
      }))
    });
  }

  await logAudit({
    projectId,
    action: "update",
    entityType: "ShootDay",
    entityId: shootDayId,
    changeNote: `Scenes assigned: ${sceneIds.length} scene(s)`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${shootDayId}`);
  revalidatePath(`/production/schedule/${shootDayId}/call-sheet`);
  return {};
}

export type AssignCrewState = { error?: string };

export async function assignCrewToDay(
  shootDayId: string,
  crewMemberIds: string[]
): Promise<AssignCrewState> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const parsed = assignCrewToDaySchema.safeParse({ shootDayId, crewMemberIds });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const day = await prisma.shootDay.findUnique({
    where: { id: shootDayId }
  });
  if (!day || day.projectId !== projectId) return { error: "Shoot day not found" };
  const validCrewCount = await prisma.crewMember.count({
    where: { id: { in: crewMemberIds }, projectId, isDeleted: false }
  });
  if (validCrewCount !== crewMemberIds.length) return { error: "One or more crew members are invalid for this project" };

  await prisma.shootDayCrew.deleteMany({ where: { shootDayId } });

  if (crewMemberIds.length > 0) {
    await prisma.shootDayCrew.createMany({
      data: crewMemberIds.map((crewMemberId) => ({
        shootDayId,
        crewMemberId
      }))
    });
  }

  await logAudit({
    projectId,
    action: "update",
    entityType: "ShootDay",
    entityId: shootDayId,
    changeNote: `Crew assigned: ${crewMemberIds.length} crew member(s)`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${shootDayId}`);
  revalidatePath(`/production/schedule/${shootDayId}/call-sheet`);
  revalidatePath("/talent/crew");
  revalidatePath("/production/catering");
  return {};
}

export async function toggleCrewDayAssignment(
  crewMemberId: string,
  shootDayId: string
): Promise<{ error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();

  const day = await prisma.shootDay.findFirst({
    where: { id: shootDayId, projectId, isDeleted: false }
  });
  if (!day) return { error: "Shoot day not found" };

  const crew = await prisma.crewMember.findFirst({
    where: { id: crewMemberId, projectId, isDeleted: false }
  });
  if (!crew) return { error: "Crew member not found" };

  const existing = await prisma.shootDayCrew.findUnique({
    where: { shootDayId_crewMemberId: { shootDayId, crewMemberId } }
  });

  if (existing) {
    await prisma.shootDayCrew.delete({ where: { id: existing.id } });
  } else {
    await prisma.shootDayCrew.create({
      data: { shootDayId, crewMemberId }
    });
  }

  revalidatePath("/production/schedule");
  revalidatePath(`/production/schedule/${shootDayId}`);
  revalidatePath(`/production/schedule/${shootDayId}/call-sheet`);
  revalidatePath("/talent/crew");
  revalidatePath(`/talent/crew/${crewMemberId}`);
  revalidatePath("/production/catering");
  return {};
}

export async function reorderDayScenes(
  shootDayId: string,
  sceneIds: string[]
): Promise<AssignScenesState> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const parsed = reorderDayScenesSchema.safeParse({
    shootDayId,
    sceneIds
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.shootDayScene.findMany({
    where: { shootDayId, shootDay: { projectId } },
    orderBy: { sortOrder: "asc" }
  });

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < sceneIds.length; i++) {
      const sceneId = sceneIds[i];
      const row = existing.find((s) => s.sceneId === sceneId);
      if (row) {
        await tx.shootDayScene.update({
          where: { id: row.id },
          data: { sortOrder: i }
        });
      }
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "ShootDay",
    entityId: shootDayId,
    changeNote: "Scene order updated",
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${shootDayId}`);
  revalidatePath(`/production/schedule/${shootDayId}/call-sheet`);
  return {};
}

/** Server action: fetch scenes for a location (for create/detail scene checklist). */
export async function getScenesForLocationAction(locationId: string) {
  if (!locationId?.trim()) return [];
  const projectId = await requireCurrentProjectId();
  return getScenesForLocation(locationId.trim(), projectId);
}

/** Server action: fetch schedule status for scene IDs (for "also on Day X" badges). Serializable. */
export async function getSceneScheduleStatusAction(
  sceneIds: string[],
  excludeShootDayId?: string
): Promise<Record<string, Array<{ id: string; date: string; dayNumber: number }>>> {
  if (sceneIds.length === 0) return {};
  const projectId = await requireCurrentProjectId();
  const map = await getSceneScheduleStatus(sceneIds, projectId, { excludeShootDayId });
  const record: Record<string, Array<{ id: string; date: string; dayNumber: number }>> = {};
  map.forEach((days, sceneId) => {
    record[sceneId] = days.map((d) => ({
      id: d.id,
      date: d.date.toISOString(),
      dayNumber: d.dayNumber
    }));
  });
  return record;
}

/** Server action: get day number map for all shoot days (for list/detail). */
export async function getShootDayNumberMapAction(): Promise<Record<string, number>> {
  const projectId = await requireCurrentProjectId();
  const map = await getShootDayNumberMap(projectId);
  return Object.fromEntries(map);
}
