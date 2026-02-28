"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { generateCreditsText } from "@/lib/credits";
import {
  createCastMemberSchema,
  updateCastMemberSchema
} from "@/lib/validators";
import { syncTaskFromEntity } from "@/lib/task-entity-sync";

import { type ActionResult } from "@/lib/action-result";

function parseNum(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

export async function createCastMember(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("cast");
  const projectId = await requireCurrentProjectId();
  const raw = {
    name: formData.get("name"),
    roleName: (formData.get("roleName") as string) || undefined,
    actorName: (formData.get("actorName") as string) || undefined,
    castingLink: formData.get("castingLink") ?? undefined,
    status: formData.get("status") ?? "TBD",
    phone: (formData.get("phone") as string) || undefined,
    email: formData.get("email") ?? undefined,
    includePhoneOnCallSheet: parseCheckbox(formData.get("includePhoneOnCallSheet")),
    includeEmailOnCallSheet: parseCheckbox(formData.get("includeEmailOnCallSheet")),
    emergencyContactName: (formData.get("emergencyContactName") as string) || undefined,
    emergencyContactPhone: (formData.get("emergencyContactPhone") as string) || undefined,
    emergencyContactRelation: (formData.get("emergencyContactRelation") as string) || undefined,
    dietaryRestrictions: (formData.get("dietaryRestrictions") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    rate: parseNum(formData.get("rate")),
    days: parseNum(formData.get("days")),
    flatFee: parseNum(formData.get("flatFee")),
    plannedAmount: parseNum(formData.get("plannedAmount"))
  };
  if (raw.castingLink === "") raw.castingLink = "";
  if (raw.email === "") raw.email = "";

  const parsed = createCastMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const cast = await prisma.castMember.create({
    data: {
      projectId,
      name: data.name,
      roleName: data.roleName ?? null,
      actorName: data.actorName === "" || !data.actorName ? null : data.actorName,
      castingLink:
        data.castingLink === "" ? null : (data.castingLink ?? null),
      status: data.status,
      phone: data.phone ?? null,
      email: data.email === "" ? null : (data.email ?? null),
      includePhoneOnCallSheet: data.includePhoneOnCallSheet,
      includeEmailOnCallSheet: data.includeEmailOnCallSheet,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      emergencyContactRelation: data.emergencyContactRelation ?? null,
      dietaryRestrictions: data.dietaryRestrictions ?? null,
      notes: data.notes ?? null,
      rate: data.rate ?? null,
      days: data.days ?? null,
      flatFee: data.flatFee ?? null,
      plannedAmount: data.plannedAmount ?? null,
      budgetBucket: "Talent"
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "CastMember",
    entityId: cast.id,
    after: cast,
    changeNote: `Cast member "${cast.name}" created`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/talent/cast");
  revalidatePath("/script/scenes");
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export async function updateCastMember(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("cast");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.castMember.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Cast member not found" };

  const raw = {
    id,
    name: formData.get("name"),
    roleName: (formData.get("roleName") as string | null) ?? undefined,
    actorName: (formData.get("actorName") as string | null) ?? undefined,
    castingLink: (formData.get("castingLink") as string | null) ?? undefined,
    status: formData.get("status"),
    phone: (formData.get("phone") as string | null) ?? undefined,
    email: (formData.get("email") as string | null) ?? undefined,
    includePhoneOnCallSheet: parseCheckbox(formData.get("includePhoneOnCallSheet")),
    includeEmailOnCallSheet: parseCheckbox(formData.get("includeEmailOnCallSheet")),
    emergencyContactName: (formData.get("emergencyContactName") as string | null) ?? undefined,
    emergencyContactPhone: (formData.get("emergencyContactPhone") as string | null) ?? undefined,
    emergencyContactRelation: (formData.get("emergencyContactRelation") as string | null) ?? undefined,
    dietaryRestrictions: (formData.get("dietaryRestrictions") as string | null) ?? undefined,
    notes: (formData.get("notes") as string | null) ?? undefined,
    rate: parseNum(formData.get("rate")),
    days: parseNum(formData.get("days")),
    flatFee: parseNum(formData.get("flatFee")),
    plannedAmount: parseNum(formData.get("plannedAmount"))
  };

  const parsed = updateCastMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const updatePayload: Parameters<typeof prisma.castMember.update>[0]["data"] =
    {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.roleName !== undefined) updatePayload.roleName = data.roleName || null;
  if (data.actorName !== undefined) updatePayload.actorName = data.actorName || null;
  if (data.castingLink !== undefined) updatePayload.castingLink = data.castingLink || null;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.phone !== undefined) updatePayload.phone = data.phone || null;
  if (data.email !== undefined) updatePayload.email = data.email || null;
  if (data.includePhoneOnCallSheet !== undefined)
    updatePayload.includePhoneOnCallSheet = data.includePhoneOnCallSheet;
  if (data.includeEmailOnCallSheet !== undefined)
    updatePayload.includeEmailOnCallSheet = data.includeEmailOnCallSheet;
  if (data.emergencyContactName !== undefined)
    updatePayload.emergencyContactName = data.emergencyContactName || null;
  if (data.emergencyContactPhone !== undefined)
    updatePayload.emergencyContactPhone = data.emergencyContactPhone || null;
  if (data.emergencyContactRelation !== undefined)
    updatePayload.emergencyContactRelation = data.emergencyContactRelation || null;
  if (data.dietaryRestrictions !== undefined)
    updatePayload.dietaryRestrictions = data.dietaryRestrictions || null;
  if (data.notes !== undefined) updatePayload.notes = data.notes || null;
  if (data.rate !== undefined) updatePayload.rate = data.rate;
  if (data.days !== undefined) updatePayload.days = data.days;
  if (data.flatFee !== undefined) updatePayload.flatFee = data.flatFee;
  if (data.plannedAmount !== undefined) updatePayload.plannedAmount = data.plannedAmount ?? null;

  const afterRecord = await prisma.castMember.update({
    where: { id },
    data: updatePayload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "CastMember",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  if (before.status !== afterRecord.status) {
    await syncTaskFromEntity("CastMember", id, afterRecord.status);
  }

  revalidatePath("/talent/cast");
  revalidatePath(`/talent/cast/${id}`);
  revalidatePath("/script/scenes");
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function deleteCastMember(id: string): Promise<ActionResult> {
  await requireSectionAccess("cast");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.castMember.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Cast member not found" };

  await prisma.castMember.update({
    where: { id },
    data: { isDeleted: true }
  });

  // Clean up join rows so deleted cast members don't appear on call sheets / scene breakdowns
  await prisma.sceneCast.deleteMany({ where: { castMemberId: id } });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "CastMember",
    entityId: id,
    before,
    changeNote: "Cast member soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/talent/cast");
  revalidatePath("/script/scenes");
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function restoreCastMember(id: string): Promise<ActionResult> {
  await requireSectionAccess("cast");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.castMember.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Cast member not found" };

  const afterRecord = await prisma.castMember.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "CastMember",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Cast member restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/talent/cast");
  revalidatePath(`/talent/cast/${id}`);
  revalidatePath("/script/scenes");
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function getCreditsText(): Promise<{ text: string }> {
  try {
    await requireSectionAccess("cast");
  } catch {
    await requireSectionAccess("crew");
  }
  const text = await generateCreditsText();
  return { text };
}
