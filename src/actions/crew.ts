"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  createCrewMemberSchema,
  updateCrewMemberSchema
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

export async function createCrewMember(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("crew");
  const projectId = await requireCurrentProjectId();
  const raw = {
    name: formData.get("name"),
    position: formData.get("position"),
    phone: (formData.get("phone") as string) || undefined,
    email: formData.get("email") ?? undefined,
    includePhoneOnCallSheet: parseCheckbox(formData.get("includePhoneOnCallSheet")),
    includeEmailOnCallSheet: parseCheckbox(formData.get("includeEmailOnCallSheet")),
    emergencyContactName: (formData.get("emergencyContactName") as string) || undefined,
    emergencyContactPhone: (formData.get("emergencyContactPhone") as string) || undefined,
    emergencyContactRelation: (formData.get("emergencyContactRelation") as string) || undefined,
    dietaryRestrictions: (formData.get("dietaryRestrictions") as string) || undefined,
    status: formData.get("status") ?? "TBD",
    notes: (formData.get("notes") as string) || undefined,
    rate: parseNum(formData.get("rate")),
    days: parseNum(formData.get("days")),
    flatFee: parseNum(formData.get("flatFee")),
    plannedAmount: parseNum(formData.get("plannedAmount"))
  };
  if (raw.email === "") raw.email = "";

  const parsed = createCrewMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const crew = await prisma.crewMember.create({
    data: {
      projectId,
      name: data.name,
      position: data.position,
      phone: data.phone ?? null,
      email: data.email === "" ? null : (data.email ?? null),
      includePhoneOnCallSheet: data.includePhoneOnCallSheet,
      includeEmailOnCallSheet: data.includeEmailOnCallSheet,
      emergencyContactName: data.emergencyContactName ?? null,
      emergencyContactPhone: data.emergencyContactPhone ?? null,
      emergencyContactRelation: data.emergencyContactRelation ?? null,
      dietaryRestrictions: data.dietaryRestrictions ?? null,
      status: data.status,
      notes: data.notes ?? null,
      rate: data.rate ?? null,
      days: data.days ?? null,
      flatFee: data.flatFee ?? null,
      plannedAmount: data.plannedAmount ?? null,
      budgetBucket: "Crew"
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "CrewMember",
    entityId: crew.id,
    after: crew,
    changeNote: `Crew member "${crew.name}" created`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/talent/crew");
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  revalidatePath("/");
  return {};
}

export async function updateCrewMember(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("crew");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.crewMember.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Crew member not found" };

  const raw = {
    id,
    name: formData.get("name"),
    position: formData.get("position"),
    phone: (formData.get("phone") as string | null) ?? undefined,
    email: (formData.get("email") as string | null) ?? undefined,
    includePhoneOnCallSheet: parseCheckbox(formData.get("includePhoneOnCallSheet")),
    includeEmailOnCallSheet: parseCheckbox(formData.get("includeEmailOnCallSheet")),
    emergencyContactName: (formData.get("emergencyContactName") as string | null) ?? undefined,
    emergencyContactPhone: (formData.get("emergencyContactPhone") as string | null) ?? undefined,
    emergencyContactRelation: (formData.get("emergencyContactRelation") as string | null) ?? undefined,
    dietaryRestrictions: (formData.get("dietaryRestrictions") as string | null) ?? undefined,
    status: formData.get("status"),
    notes: (formData.get("notes") as string | null) ?? undefined,
    rate: parseNum(formData.get("rate")),
    days: parseNum(formData.get("days")),
    flatFee: parseNum(formData.get("flatFee")),
    plannedAmount: parseNum(formData.get("plannedAmount"))
  };

  const parsed = updateCrewMemberSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const updatePayload: Parameters<typeof prisma.crewMember.update>[0]["data"] =
    {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.position !== undefined) updatePayload.position = data.position;
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
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.notes !== undefined) updatePayload.notes = data.notes || null;
  if (data.rate !== undefined) updatePayload.rate = data.rate;
  if (data.days !== undefined) updatePayload.days = data.days;
  if (data.flatFee !== undefined) updatePayload.flatFee = data.flatFee;
  if (data.plannedAmount !== undefined) updatePayload.plannedAmount = data.plannedAmount ?? null;

  const afterRecord = await prisma.crewMember.update({
    where: { id },
    data: updatePayload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "CrewMember",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  if (before.status !== afterRecord.status) {
    await syncTaskFromEntity("CrewMember", id, afterRecord.status);
  }

  revalidatePath("/talent/crew");
  revalidatePath(`/talent/crew/${id}`);
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function deleteCrewMember(id: string): Promise<ActionResult> {
  await requireSectionAccess("crew");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.crewMember.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Crew member not found" };

  await prisma.crewMember.update({
    where: { id },
    data: { isDeleted: true }
  });

  // Clean up join rows so deleted crew members don't appear on shoot day assignments
  await prisma.shootDayCrew.deleteMany({ where: { crewMemberId: id } });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "CrewMember",
    entityId: id,
    before,
    changeNote: "Crew member soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/talent/crew");
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function restoreCrewMember(id: string): Promise<ActionResult> {
  await requireSectionAccess("crew");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.crewMember.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Crew member not found" };

  const afterRecord = await prisma.crewMember.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "CrewMember",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Crew member restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/talent/crew");
  revalidatePath(`/talent/crew/${id}`);
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}
