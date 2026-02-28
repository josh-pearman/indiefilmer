"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { validateFileType, validateFileSize } from "@/lib/file-validation";
import { checkStorageQuota } from "@/lib/storage-quota";
import {
  createLineItemSchema,
  updateLineItemSchema
} from "@/lib/validators";

import { type ActionResult } from "@/lib/action-result";

function getReceiptsDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "receipts");
}

function getExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".pdf"].includes(ext)) return ext;
  if (filename.toLowerCase().endsWith(".jpeg")) return ".jpeg";
  return ".bin";
}

export async function createLineItem(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const raw = {
    bucketId: formData.get("bucketId"),
    description: formData.get("description"),
    plannedAmount: formData.get("plannedAmount")
      ? Number(formData.get("plannedAmount"))
      : undefined,
    actualAmount: formData.get("actualAmount")
      ? Number(formData.get("actualAmount"))
      : undefined,
    date: formData.get("date"),
    notes: (formData.get("notes") as string) || undefined,
    sourceType: (formData.get("sourceType") as string) || undefined,
    sourceId: (formData.get("sourceId") as string) || undefined
  };
  const parsed = createLineItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  let receiptPath: string | null = null;
  const receiptFile = formData.get("receipt") as File | null;
  if (receiptFile && receiptFile.size > 0) {
    const receiptValidation = validateFileType(receiptFile, "receipts");
    if (!receiptValidation.valid) return { error: receiptValidation.error };
    const receiptSizeValidation = validateFileSize(receiptFile, "receipts");
    if (!receiptSizeValidation.valid) return { error: receiptSizeValidation.error };
    const quotaCheck = await checkStorageQuota(projectId, receiptFile.size);
    if (!quotaCheck.allowed) return { error: quotaCheck.error };
    const dir = getReceiptsDir(projectId);
    await mkdir(dir, { recursive: true });
    const ext = getExtension(receiptFile.name);
    const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    const filePath = path.join(dir, filename);
    const buffer = Buffer.from(await receiptFile.arrayBuffer());
    await writeFile(filePath, buffer);
    receiptPath = filename;
  }

  const bucket = await prisma.budgetBucket.findUnique({
    where: { id: parsed.data.bucketId }
  });
  if (!bucket || bucket.projectId !== projectId) return { error: "Bucket not found" };

  const dateVal = parsed.data.date ? new Date(parsed.data.date) : null;
  const item = await prisma.budgetLineItem.create({
    data: {
      bucketId: parsed.data.bucketId,
      projectId,
      description: parsed.data.description,
      plannedAmount: parsed.data.plannedAmount ?? null,
      actualAmount: parsed.data.actualAmount,
      date: dateVal,
      notes: parsed.data.notes ?? null,
      receiptPath,
      sourceType: parsed.data.sourceType ?? null,
      sourceId: parsed.data.sourceId ?? null
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "BudgetLineItem",
    entityId: item.id,
    after: item,
    changeNote: `Line item: ${parsed.data.description}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/accounting/expenses");
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}

export async function updateLineItem(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.budgetLineItem.findUnique({
    where: { id }
  });
  if (!before || before.projectId !== projectId) return { error: "Line item not found" };

  const raw = {
    id,
    bucketId: formData.get("bucketId"),
    description: formData.get("description"),
    plannedAmount: formData.get("plannedAmount")
      ? Number(formData.get("plannedAmount"))
      : undefined,
    actualAmount: formData.get("actualAmount")
      ? Number(formData.get("actualAmount"))
      : undefined,
    date: formData.get("date"),
    notes: (formData.get("notes") as string) ?? undefined,
    sourceType: (formData.get("sourceType") as string) ?? undefined,
    sourceId: (formData.get("sourceId") as string) ?? undefined
  };
  const parsed = updateLineItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const payload: Parameters<typeof prisma.budgetLineItem.update>[0]["data"] = {};
  if (data.bucketId !== undefined) payload.bucketId = data.bucketId;
  if (data.description !== undefined) payload.description = data.description;
  if (data.plannedAmount !== undefined)
    payload.plannedAmount = data.plannedAmount ?? null;
  if (data.actualAmount !== undefined) payload.actualAmount = data.actualAmount;
  if (data.date !== undefined)
    payload.date = data.date ? new Date(data.date) : null;
  if (data.notes !== undefined) payload.notes = data.notes || null;
  if (data.sourceType !== undefined)
    payload.sourceType = data.sourceType || null;
  if (data.sourceId !== undefined) payload.sourceId = data.sourceId || null;

  const after = await prisma.budgetLineItem.update({
    where: { id },
    data: payload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "BudgetLineItem",
    entityId: id,
    before,
    after,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/accounting/expenses");
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}

export async function deleteLineItem(id: string): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.budgetLineItem.findUnique({
    where: { id }
  });
  if (!before || before.projectId !== projectId) return { error: "Line item not found" };

  await prisma.budgetLineItem.update({
    where: { id },
    data: { isDeleted: true }
  });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "BudgetLineItem",
    entityId: id,
    before,
    changeNote: "Line item soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/accounting/expenses");
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}

export async function restoreLineItem(id: string): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.budgetLineItem.findUnique({
    where: { id }
  });
  if (!before || before.projectId !== projectId) return { error: "Line item not found" };

  const after = await prisma.budgetLineItem.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "BudgetLineItem",
    entityId: id,
    before,
    after,
    changeNote: "Line item restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/accounting/expenses");
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}

export async function rollbackLineItem(id: string): Promise<ActionResult> {
  await requireSectionAccess("budget");
  const projectId = await requireCurrentProjectId();
  const item = await prisma.budgetLineItem.findUnique({
    where: { id }
  });
  if (!item || item.projectId !== projectId) return { error: "Line item not found" };

  const lastChange = await prisma.auditLog.findFirst({
    where: {
      projectId,
      entityType: "BudgetLineItem",
      entityId: id,
      action: { in: ["update", "delete"] }
    },
    orderBy: { createdAt: "desc" }
  });
  if (!lastChange?.before) {
    return { error: "No previous version to restore" };
  }
  let beforeData: Record<string, unknown>;
  try {
    beforeData = JSON.parse(lastChange.before) as Record<string, unknown>;
  } catch {
    return { error: "Could not parse previous version" };
  }

  const payload: Parameters<typeof prisma.budgetLineItem.update>[0]["data"] = {};
  if (typeof beforeData.description === "string")
    payload.description = beforeData.description;
  if (typeof beforeData.plannedAmount === "number")
    payload.plannedAmount = beforeData.plannedAmount;
  else if (beforeData.plannedAmount === null)
    payload.plannedAmount = null;
  if (typeof beforeData.actualAmount === "number")
    payload.actualAmount = beforeData.actualAmount;
  if (beforeData.date) payload.date = new Date(beforeData.date as string);
  else if (beforeData.date === null) payload.date = null;
  if (typeof beforeData.notes === "string") payload.notes = beforeData.notes;
  else if (beforeData.notes === null) payload.notes = null;
  if (typeof beforeData.sourceType === "string")
    payload.sourceType = beforeData.sourceType;
  else if (beforeData.sourceType === null) payload.sourceType = null;
  if (typeof beforeData.sourceId === "string")
    payload.sourceId = beforeData.sourceId;
  else if (beforeData.sourceId === null) payload.sourceId = null;
  if (lastChange.action === "delete") payload.isDeleted = false;

  const after = await prisma.budgetLineItem.update({
    where: { id },
    data: payload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "BudgetLineItem",
    entityId: id,
    before: item,
    after,
    changeNote: "Rolled back to previous version",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/accounting/expenses");
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}
