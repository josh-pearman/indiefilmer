"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";

type ContactField =
  | "phone"
  | "email"
  | "emergencyContactName"
  | "emergencyContactPhone";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateContactInfo(
  type: "cast" | "crew",
  id: string,
  field: ContactField,
  value: string
): Promise<{ error?: string }> {
  await requireSectionAccess("contacts");
  const projectId = await requireCurrentProjectId();
  if (field === "email" && value !== "" && !EMAIL_REGEX.test(value)) {
    return { error: "Invalid email address" };
  }

  const data = { [field]: value || null };

  if (type === "cast") {
    const before = await prisma.castMember.findFirst({ where: { id, projectId } });
    if (!before) return { error: "Cast member not found" };

    const after = await prisma.castMember.update({ where: { id }, data });

    await logAudit({
      action: "update",
      entityType: "CastMember",
      entityId: id,
      before,
      after,
      changeNote: `Updated ${field} via contacts page`,
      performedBy: await getPerformedBy(),
    });

    revalidatePath("/talent/contacts");
    revalidatePath("/talent/cast");
    revalidatePath(`/talent/cast/${id}`);
  } else {
    const before = await prisma.crewMember.findFirst({ where: { id, projectId } });
    if (!before) return { error: "Crew member not found" };

    const after = await prisma.crewMember.update({ where: { id }, data });

    await logAudit({
      action: "update",
      entityType: "CrewMember",
      entityId: id,
      before,
      after,
      changeNote: `Updated ${field} via contacts page`,
      performedBy: await getPerformedBy(),
    });

    revalidatePath("/talent/contacts");
    revalidatePath("/talent/crew");
    revalidatePath(`/talent/crew/${id}`);
  }

  return {};
}
