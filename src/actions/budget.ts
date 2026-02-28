"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  updateTotalBudgetSchema,
  updateBucketPlannedSchema
} from "@/lib/validators";
import { calculateBudgetRollup } from "@/lib/budget-rollup";
import type { BudgetRollupData } from "@/lib/budget-rollup";

import { type ActionResult } from "@/lib/action-result";

export async function updateTotalBudget(
  amount: number
): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const parsed = updateTotalBudgetSchema.safeParse({ amount });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.projectSettings.findUnique({
    where: { projectId }
  });
  const after = await prisma.projectSettings.upsert({
    where: { projectId },
    create: { projectId, totalBudget: parsed.data.amount },
    update: { totalBudget: parsed.data.amount }
  });
  await logAudit({
    projectId,
    action: "update",
    entityType: "ProjectSettings",
    entityId: projectId,
    before,
    after,
    changeNote: `Total budget set to $${parsed.data.amount.toLocaleString()}`,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/accounting/budget");
  revalidatePath("/settings");
  revalidatePath("/");
  return {};
}

export async function updateBucketPlanned(
  bucketId: string,
  amount: number
): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const parsed = updateBucketPlannedSchema.safeParse({ bucketId, amount });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }
  const before = await prisma.budgetBucket.findFirst({
    where: { id: parsed.data.bucketId, projectId }
  });
  if (!before) return { error: "Bucket not found" };
  const after = await prisma.budgetBucket.update({
    where: { id: parsed.data.bucketId },
    data: { plannedAmount: parsed.data.amount }
  });
  await logAudit({
    projectId,
    action: "update",
    entityType: "BudgetBucket",
    entityId: parsed.data.bucketId,
    before,
    after,
    changeNote: `${before.name} planned amount set to $${parsed.data.amount.toLocaleString()}`,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}

export async function getBudgetRollup(): Promise<BudgetRollupData> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  return calculateBudgetRollup(projectId);
}
