"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  updateShootDayMealSchema,
  createCateringDaySchema,
  updateCateringDaySchema,
  updateCateringDayMealSchema
} from "@/lib/validators";

import { type ActionResult } from "@/lib/action-result";

const MEAL_TYPES = ["crafty", "lunch", "dinner"] as const;

async function getCraftDefaults(projectId: string) {
  const settings = await prisma.projectSettings.findUnique({
    where: { projectId }
  });
  return {
    craftyPerPerson: settings?.craftyPerPerson ?? 5,
    lunchPerPerson: settings?.lunchPerPerson ?? 12,
    dinnerPerPerson: settings?.dinnerPerPerson ?? 12,
    craftyEnabledByDefault: settings?.craftyEnabledByDefault ?? true,
    lunchEnabledByDefault: settings?.lunchEnabledByDefault ?? true,
    dinnerEnabledByDefault: settings?.dinnerEnabledByDefault ?? false
  };
}

export async function ensureShootDayMeals(shootDayId: string): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const shootDay = await prisma.shootDay.findUnique({
    where: { id: shootDayId },
    select: { projectId: true }
  });
  if (!shootDay?.projectId || shootDay.projectId !== projectId) return { error: "Shoot day or project not found" };
  const existing = await prisma.shootDayMeal.findMany({
    where: { shootDayId }
  });
  if (existing.length >= 3) return {};
  const defaults = await getCraftDefaults(shootDay.projectId);
  const have = new Set(existing.map((m) => m.mealType));
  const toCreate = MEAL_TYPES.filter((t) => !have.has(t)).map((mealType) => ({
    shootDayId,
    mealType,
    enabled:
      mealType === "crafty"
        ? defaults.craftyEnabledByDefault
        : mealType === "lunch"
          ? defaults.lunchEnabledByDefault
          : defaults.dinnerEnabledByDefault
  }));
  if (toCreate.length === 0) return {};
  await prisma.shootDayMeal.createMany({ data: toCreate });
  revalidatePath("/production/catering");
  return {};
}

export async function updateShootDayMeal(
  id: string,
  data: {
    enabled?: boolean;
    vendor?: string;
    estimatedCost?: number | null;
    actualCost?: number | null;
    notes?: string;
  }
): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const parsed = updateShootDayMealSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.shootDayMeal.findUnique({
    where: { id },
    include: { shootDay: { select: { projectId: true } } }
  });
  if (!before || before.shootDay.projectId !== projectId) return { error: "Meal not found" };
  const payload: Parameters<typeof prisma.shootDayMeal.update>[0]["data"] = {};
  if (parsed.data.enabled !== undefined) payload.enabled = parsed.data.enabled;
  if (parsed.data.vendor !== undefined) payload.vendor = parsed.data.vendor ?? null;
  if (parsed.data.estimatedCost !== undefined) payload.estimatedCost = parsed.data.estimatedCost;
  if (parsed.data.actualCost !== undefined) payload.actualCost = parsed.data.actualCost;
  if (parsed.data.notes !== undefined) payload.notes = parsed.data.notes ?? null;
  const afterRecord = await prisma.shootDayMeal.update({
    where: { id },
    data: payload
  });
  await logAudit({
    projectId,
    action: "update",
    entityType: "ShootDayMeal",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export async function calculateDefaultMealCost(
  shootDayId: string,
  mealType: string
): Promise<{ cost: number }> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const shootDay = await prisma.shootDay.findUnique({
    where: { id: shootDayId, isDeleted: false },
    include: {
      scenes: { include: { scene: { include: { castAssignments: { include: { castMember: true } } } } } }
    }
  });
  if (!shootDay || !shootDay.projectId || shootDay.projectId !== projectId) return { cost: 0 };
  const defaults = await getCraftDefaults(shootDay.projectId);
  const castIds = new Set<string>();
  for (const sds of shootDay.scenes) {
    for (const a of sds.scene.castAssignments) {
      if (!a.castMember.isDeleted) castIds.add(a.castMember.id);
    }
  }
  const castCount = castIds.size;
  const crewCount = await prisma.crewMember.count({ where: { projectId: shootDay.projectId, isDeleted: false } });
  const headcount = castCount + crewCount;
  const perPerson =
    mealType === "crafty"
      ? defaults.craftyPerPerson
      : mealType === "lunch"
        ? defaults.lunchPerPerson
        : defaults.dinnerPerPerson;
  return { cost: headcount * perPerson };
}

// ─── Standalone Catering Days ─────────────────────────────

export async function createCateringDay(formData: FormData): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const rawDate = formData.get("date");
  const parsed = createCateringDaySchema.safeParse({
    date: rawDate || undefined,
    label: formData.get("label"),
    locationName: formData.get("locationName"),
    headcount: formData.get("headcount")
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const defaults = await getCraftDefaults(projectId);
  const day = await prisma.$transaction(async (tx) => {
    const created = await tx.cateringDay.create({
      data: {
        project: { connect: { id: projectId } },
        date: parsed.data.date ? new Date(parsed.data.date) : null,
        label: parsed.data.label,
        locationName: parsed.data.locationName || null,
        headcount: parsed.data.headcount
      }
    });
    await tx.cateringDayMeal.createMany({
      data: MEAL_TYPES.map((mealType) => ({
        cateringDayId: created.id,
        mealType,
        enabled:
          mealType === "crafty"
            ? defaults.craftyEnabledByDefault
            : mealType === "lunch"
              ? defaults.lunchEnabledByDefault
              : defaults.dinnerEnabledByDefault
      }))
    });
    return created;
  });
  await logAudit({
    projectId,
    action: "create",
    entityType: "CateringDay",
    entityId: day.id,
    before: null,
    after: day,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/catering");
  return {};
}

export async function updateCateringDay(
  id: string,
  data: { date?: string; label?: string; locationName?: string | null; headcount?: number }
): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const parsed = updateCateringDaySchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.cateringDay.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Catering day not found" };
  const payload: Parameters<typeof prisma.cateringDay.update>[0]["data"] = {};
  if (parsed.data.date) payload.date = new Date(parsed.data.date);
  if (parsed.data.label) payload.label = parsed.data.label;
  if (parsed.data.locationName !== undefined) payload.locationName = parsed.data.locationName;
  if (parsed.data.headcount !== undefined) payload.headcount = parsed.data.headcount;
  const afterRecord = await prisma.cateringDay.update({ where: { id }, data: payload });
  await logAudit({
    projectId,
    action: "update",
    entityType: "CateringDay",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/catering");
  return {};
}

export async function updateCateringDayMeal(
  id: string,
  data: {
    enabled?: boolean;
    vendor?: string;
    estimatedCost?: number | null;
    actualCost?: number | null;
    notes?: string;
  }
): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const parsed = updateCateringDayMealSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.cateringDayMeal.findUnique({
    where: { id },
    include: { cateringDay: { select: { projectId: true } } }
  });
  if (!before || before.cateringDay.projectId !== projectId) return { error: "Meal not found" };
  const payload: Parameters<typeof prisma.cateringDayMeal.update>[0]["data"] = {};
  if (parsed.data.enabled !== undefined) payload.enabled = parsed.data.enabled;
  if (parsed.data.vendor !== undefined) payload.vendor = parsed.data.vendor ?? null;
  if (parsed.data.estimatedCost !== undefined) payload.estimatedCost = parsed.data.estimatedCost;
  if (parsed.data.actualCost !== undefined) payload.actualCost = parsed.data.actualCost;
  if (parsed.data.notes !== undefined) payload.notes = parsed.data.notes ?? null;
  const afterRecord = await prisma.cateringDayMeal.update({ where: { id }, data: payload });
  await logAudit({
    projectId,
    action: "update",
    entityType: "CateringDayMeal",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export async function deleteCateringDay(id: string): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.cateringDay.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Catering day not found" };
  await prisma.cateringDay.update({ where: { id }, data: { isDeleted: true } });
  await logAudit({
    projectId,
    action: "delete",
    entityType: "CateringDay",
    entityId: id,
    before,
    after: { ...before, isDeleted: true },
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/catering");
  return {};
}

export async function linkCateringDayToShootDay(
  cateringDayId: string,
  shootDayId: string
): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const [cateringDay, shootDay] = await Promise.all([
    prisma.cateringDay.findUnique({ where: { id: cateringDayId } }),
    prisma.shootDay.findUnique({ where: { id: shootDayId } })
  ]);
  if (!cateringDay || cateringDay.projectId !== projectId) return { error: "Catering day not found" };
  if (!shootDay || shootDay.projectId !== projectId) return { error: "Shoot day not found" };
  if (cateringDay.shootDayId) return { error: "Catering day is already linked to a shoot day" };
  const existingLink = await prisma.cateringDay.findUnique({ where: { shootDayId } });
  if (existingLink) return { error: "Shoot day already has a linked catering day" };
  await prisma.cateringDay.update({
    where: { id: cateringDayId },
    data: { shootDayId }
  });
  await logAudit({
    projectId,
    action: "update",
    entityType: "CateringDay",
    entityId: cateringDayId,
    before: cateringDay,
    after: { ...cateringDay, shootDayId },
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  return {};
}

export async function unlinkCateringDayFromShootDay(
  cateringDayId: string
): Promise<ActionResult> {
  await requireSectionAccess("craft-services");
  const projectId = await requireCurrentProjectId();
  const cateringDay = await prisma.cateringDay.findUnique({ where: { id: cateringDayId } });
  if (!cateringDay || cateringDay.projectId !== projectId) return { error: "Catering day not found" };
  if (!cateringDay.shootDayId) return { error: "Catering day is not linked to a shoot day" };
  await prisma.cateringDay.update({
    where: { id: cateringDayId },
    data: { shootDayId: null }
  });
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  return {};
}

export async function getUnlinkedCateringDays(): Promise<
  Array<{ id: string; date: string; label: string }>
> {
  const projectId = await requireCurrentProjectId();
  const days = await prisma.cateringDay.findMany({
    where: { projectId, isDeleted: false, shootDayId: null },
    orderBy: { date: "asc" },
    select: { id: true, date: true, label: true }
  });
  return days.map((d) => ({
    id: d.id,
    date: d.date ? d.date.toISOString().slice(0, 10) : "TBD",
    label: d.label
  }));
}
