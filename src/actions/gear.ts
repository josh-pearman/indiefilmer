"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  updateGearModelNameSchema,
  updateGearItemSchema,
  toggleGearItemDaySchema
} from "@/lib/validators";

import { type ActionResult } from "@/lib/action-result";

export async function createGearModel(): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const maxOrder = await prisma.gearModel
    .aggregate({
      _max: { sortOrder: true },
      where: { projectId, isDeleted: false }
    })
    .then((r) => r._max.sortOrder ?? -1);

  const model = await prisma.gearModel.create({
    data: {
      projectId,
      name: "New Model",
      isActive: false,
      sortOrder: maxOrder + 1
    }
  });

  const shootDays = await prisma.shootDay.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { date: "asc" },
    select: { id: true }
  });

  await prisma.gearItem.create({
    data: {
      gearModelId: model.id,
      name: "",
      category: "Other",
      costAmount: 0,
      costType: "per_day",
      sortOrder: 0,
      daySelections: {
        create: shootDays.map((d) => ({
          shootDayId: d.id,
          selected: true
        }))
      }
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "GearModel",
    entityId: model.id,
    after: model,
    changeNote: "Gear model created",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  revalidatePath("/accounting/budget");
  return {};
}

export async function updateGearModelName(
  id: string,
  name: string
): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const parsed = updateGearModelNameSchema.safeParse({ id, name });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.gearModel.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Model not found" };

  const afterRecord = await prisma.gearModel.update({
    where: { id },
    data: { name: parsed.data.name }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "GearModel",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  return {};
}

export async function toggleGearModelActive(id: string): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.gearModel.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Model not found" };

  const afterRecord = await prisma.gearModel.update({
    where: { id },
    data: { isActive: !before.isActive }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "GearModel",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: `Model ${afterRecord.isActive ? "activated" : "deactivated"}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  revalidatePath("/accounting/budget");
  return {};
}

export async function updateGearModelPlannedBudget(
  id: string,
  plannedAmount: number | null
): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  if (plannedAmount !== null && (!Number.isFinite(plannedAmount) || plannedAmount < 0)) {
    return { error: "Planned budget must be a non-negative number" };
  }
  const before = await prisma.gearModel.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Model not found" };

  const afterRecord = await prisma.gearModel.update({
    where: { id },
    data: { plannedAmount }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "GearModel",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Planned budget updated",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  revalidatePath("/accounting/budget");
  return {};
}

export async function reorderGearModelUp(id: string): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const current = await prisma.gearModel.findUnique({
    where: { id, isDeleted: false }
  });
  if (!current || current.projectId !== projectId) return { error: "Model not found" };

  const prev = await prisma.gearModel.findFirst({
    where: { projectId, isDeleted: false, sortOrder: { lt: current.sortOrder } },
    orderBy: { sortOrder: "desc" }
  });
  if (!prev) return {}; // already first

  await prisma.$transaction([
    prisma.gearModel.update({
      where: { id: current.id },
      data: { sortOrder: prev.sortOrder }
    }),
    prisma.gearModel.update({
      where: { id: prev.id },
      data: { sortOrder: current.sortOrder }
    })
  ]);

  await logAudit({
    projectId,
    action: "update",
    entityType: "GearModel",
    entityId: id,
    changeNote: "Model reordered up",
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/gear");
  return {};
}

export async function reorderGearModelDown(id: string): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const current = await prisma.gearModel.findUnique({
    where: { id, isDeleted: false }
  });
  if (!current || current.projectId !== projectId) return { error: "Model not found" };

  const next = await prisma.gearModel.findFirst({
    where: { projectId, isDeleted: false, sortOrder: { gt: current.sortOrder } },
    orderBy: { sortOrder: "asc" }
  });
  if (!next) return {}; // already last

  await prisma.$transaction([
    prisma.gearModel.update({
      where: { id: current.id },
      data: { sortOrder: next.sortOrder }
    }),
    prisma.gearModel.update({
      where: { id: next.id },
      data: { sortOrder: current.sortOrder }
    })
  ]);

  await logAudit({
    projectId,
    action: "update",
    entityType: "GearModel",
    entityId: id,
    changeNote: "Model reordered down",
    performedBy: await getPerformedBy()
  });
  revalidatePath("/production/gear");
  return {};
}

export async function deleteGearModel(id: string): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.gearModel.findUnique({
    where: { id },
    include: { items: { include: { daySelections: true } } }
  });
  if (!before || before.projectId !== projectId) return { error: "Model not found" };

  await prisma.gearItemDay.deleteMany({
    where: { gearItem: { gearModelId: id } }
  });
  await prisma.gearItem.deleteMany({ where: { gearModelId: id } });
  await prisma.gearModel.delete({ where: { id } });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "GearModel",
    entityId: id,
    before,
    changeNote: "Gear model deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  revalidatePath("/accounting/budget");
  return {};
}

export async function addGearItem(gearModelId: string): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const model = await prisma.gearModel.findUnique({
    where: { id: gearModelId },
    include: { items: true }
  });
  if (!model || model.projectId !== projectId) return { error: "Model not found" };

  const shootDays = await prisma.shootDay.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { date: "asc" },
    select: { id: true }
  });

  const maxOrder =
    model.items.length === 0
      ? 0
      : Math.max(...model.items.map((i) => i.sortOrder), 0);

  const item = await prisma.gearItem.create({
    data: {
      gearModelId,
      name: "",
      category: "Other",
      costAmount: 0,
      costType: "per_day",
      sortOrder: maxOrder + 1,
      daySelections: {
        create: shootDays.map((d) => ({
          shootDayId: d.id,
          selected: true
        }))
      }
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "GearItem",
    entityId: item.id,
    after: item,
    changeNote: "Gear item added",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  return {};
}

export type GearItemData = {
  name?: string;
  category?: string;
  costAmount?: number;
  costType?: "per_day" | "flat_rate";
  supplier?: string;
};

export async function updateGearItem(
  id: string,
  data: Partial<GearItemData>
): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const parsed = updateGearItemSchema.safeParse({ id, ...data });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.gearItem.findFirst({
    where: { id, gearModel: { projectId } }
  });
  if (!before) return { error: "Gear item not found" };

  const payload: Parameters<typeof prisma.gearItem.update>[0]["data"] = {};
  if (parsed.data.name !== undefined) payload.name = parsed.data.name;
  if (parsed.data.category !== undefined)
    payload.category = parsed.data.category;
  if (parsed.data.costAmount !== undefined)
    payload.costAmount = parsed.data.costAmount;
  if (parsed.data.costType !== undefined)
    payload.costType = parsed.data.costType;
  if (parsed.data.supplier !== undefined)
    payload.supplier = parsed.data.supplier ?? null;

  const afterRecord = await prisma.gearItem.update({
    where: { id },
    data: payload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "GearItem",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  return {};
}

export async function deleteGearItem(id: string): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.gearItem.findFirst({
    where: { id, gearModel: { projectId } },
    include: { daySelections: true }
  });
  if (!before) return { error: "Gear item not found" };

  await prisma.gearItemDay.deleteMany({ where: { gearItemId: id } });
  await prisma.gearItem.delete({ where: { id } });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "GearItem",
    entityId: id,
    before,
    changeNote: "Gear item deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/gear");
  return {};
}

export async function toggleGearItemDay(
  gearItemId: string,
  shootDayId: string
): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const parsed = toggleGearItemDaySchema.safeParse({ gearItemId, shootDayId });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const item = await prisma.gearItem.findFirst({
    where: { id: parsed.data.gearItemId, gearModel: { projectId } }
  });
  if (!item) return { error: "Gear item not found" };
  const day = await prisma.shootDay.findFirst({
    where: { id: parsed.data.shootDayId, projectId, isDeleted: false }
  });
  if (!day) return { error: "Shoot day not found" };

  const existing = await prisma.gearItemDay.findUnique({
    where: {
      gearItemId_shootDayId: {
        gearItemId: parsed.data.gearItemId,
        shootDayId: parsed.data.shootDayId
      }
    }
  });

  if (existing) {
    await prisma.gearItemDay.update({
      where: { id: existing.id },
      data: { selected: !existing.selected }
    });
  } else {
    await prisma.gearItemDay.create({
      data: {
        gearItemId: parsed.data.gearItemId,
        shootDayId: parsed.data.shootDayId,
        selected: true
      }
    });
  }

  revalidatePath("/production/gear");
  return {};
}

export async function toggleAllGearItemDays(
  gearItemId: string,
  selected: boolean
): Promise<ActionResult> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const item = await prisma.gearItem.findFirst({
    where: { id: gearItemId, gearModel: { projectId } },
    include: { daySelections: true }
  });
  if (!item) return { error: "Gear item not found" };

  if (item.daySelections.length === 0) {
    const shootDays = await prisma.shootDay.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true }
    });
    await prisma.gearItemDay.createMany({
      data: shootDays.map((d) => ({
        gearItemId,
        shootDayId: d.id,
        selected
      }))
    });
  } else {
    await prisma.gearItemDay.updateMany({
      where: { gearItemId },
      data: { selected }
    });
  }

  revalidatePath("/production/gear");
  return {};
}

/**
 * Ensures every GearItem has a GearItemDay for every shoot day (selected: true).
 * Call on page load so new shoot days get default day selections.
 */
export async function ensureGearItemDays(): Promise<void> {
  await requireSectionAccess("gear");
  const projectId = await requireCurrentProjectId();
  const shootDays = await prisma.shootDay.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { date: "asc" },
    select: { id: true }
  });
  if (shootDays.length === 0) return;

  const items = await prisma.gearItem.findMany({
    where: { gearModel: { projectId } },
    include: {
      daySelections: { select: { shootDayId: true } }
    }
  });

  const shootDayIds = new Set(shootDays.map((d) => d.id));
  const toCreate: { gearItemId: string; shootDayId: string }[] = [];

  for (const item of items) {
    const have = new Set(item.daySelections.map((d) => d.shootDayId));
    for (const dayId of shootDayIds) {
      if (!have.has(dayId)) {
        toCreate.push({ gearItemId: item.id, shootDayId: dayId });
      }
    }
  }

  if (toCreate.length > 0) {
    await prisma.gearItemDay.createMany({
      data: toCreate.map(({ gearItemId, shootDayId }) => ({
        gearItemId,
        shootDayId,
        selected: true
      }))
    });
  }
}
