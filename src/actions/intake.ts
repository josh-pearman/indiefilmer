"use server";

import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { isEmailEnabled, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { intakeFormSchema } from "@/lib/validators";
import {
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  renderTemplate,
  type TemplateVars,
} from "@/lib/intake-template";

import { type ActionResult } from "@/lib/action-result";

export type IntakeTemplate = { subject: string; body: string };

/** Load the intake template for the current project (falls back to defaults). */
async function loadTemplate(projectId: string): Promise<IntakeTemplate> {
  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
    select: { intakeEmailSubject: true, intakeEmailBody: true },
  });
  return {
    subject: settings?.intakeEmailSubject || DEFAULT_SUBJECT,
    body: settings?.intakeEmailBody || DEFAULT_BODY,
  };
}

/** Get the current intake email template for the project. */
export async function getIntakeTemplate(): Promise<IntakeTemplate> {
  const projectId = await requireCurrentProjectId();
  return loadTemplate(projectId);
}

/** Update the intake email template for the project. */
export async function updateIntakeTemplate(
  subject: string,
  body: string
): Promise<ActionResult> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();

  const trimmedSubject = subject.trim();
  const trimmedBody = body.trim();
  if (!trimmedSubject) return { error: "Subject cannot be empty." };
  if (!trimmedBody) return { error: "Body cannot be empty." };

  await prisma.projectSettings.update({
    where: { projectId },
    data: {
      intakeEmailSubject: trimmedSubject,
      intakeEmailBody: trimmedBody,
    },
  });

  revalidatePath("/talent/cast");
  revalidatePath("/talent/crew");
  revalidatePath("/talent/contacts");
  return {};
}

/** Generate a unique intake token for a cast or crew member. Requires auth. */
export async function generateIntakeToken(
  type: "cast" | "crew",
  id: string
): Promise<{ token?: string; error?: string }> {
  await requireSectionAccess(type === "cast" ? "cast" : "crew");
  await requireCurrentProjectId();

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  if (type === "cast") {
    await prisma.castMember.update({
      where: { id },
      data: { intakeToken: token, intakeTokenExpiresAt: expiresAt },
    });
  } else {
    await prisma.crewMember.update({
      where: { id },
      data: { intakeToken: token, intakeTokenExpiresAt: expiresAt },
    });
  }

  return { token };
}

/** Send an intake email directly via Resend. Requires RESEND_API_KEY. */
export async function sendIntakeEmail(
  type: "cast" | "crew",
  id: string
): Promise<{ success?: boolean; error?: string }> {
  await requireSectionAccess(type === "cast" ? "cast" : "crew");
  const projectId = await requireCurrentProjectId();

  if (!isEmailEnabled()) {
    return { error: "Email sending is not configured." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`intake-email:${ip}`, 20, 60 * 1000);
  if (!rl.allowed) {
    return { error: `Too many emails. Try again in ${rl.retryAfterSeconds}s.` };
  }

  const member =
    type === "cast"
      ? await prisma.castMember.findUnique({ where: { id }, select: { email: true, actorName: true, name: true, intakeToken: true } })
      : await prisma.crewMember.findUnique({ where: { id }, select: { email: true, name: true, intakeToken: true } });

  if (!member) {
    return { error: "Member not found." };
  }

  const recipientEmail = member.email?.trim();
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return { error: "No valid email address on file for this member." };
  }

  let token = member.intakeToken;
  if (!token) {
    token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    if (type === "cast") {
      await prisma.castMember.update({ where: { id }, data: { intakeToken: token, intakeTokenExpiresAt: expiresAt } });
    } else {
      await prisma.crewMember.update({ where: { id }, data: { intakeToken: token, intakeTokenExpiresAt: expiresAt } });
    }
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  const projectName = project?.name ?? "Untitled Project";
  const displayName = type === "cast"
    ? ((member as { actorName?: string | null }).actorName?.trim() || member.name)
    : member.name;
  const firstName = displayName.split(" ")[0];
  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  const link = `${appUrl}/intake/${token}`;

  const template = await loadTemplate(projectId);
  const vars: TemplateVars = { firstName, name: displayName, projectName, link };
  const renderedSubject = renderTemplate(template.subject, vars);
  const renderedBody = renderTemplate(template.body, vars);

  try {
    await sendEmail(recipientEmail, renderedSubject, renderedBody);
    return { success: true };
  } catch {
    return { error: "Failed to send email. Please try again." };
  }
}

/** Submit the intake form. Public — no auth required. */
export async function submitIntakeForm(
  token: string,
  data: Record<string, string>
): Promise<ActionResult> {
  // Look up across both tables
  const [castMember, crewMember] = await Promise.all([
    prisma.castMember.findUnique({ where: { intakeToken: token } }),
    prisma.crewMember.findUnique({ where: { intakeToken: token } }),
  ]);

  const record = castMember ?? crewMember;
  if (!record) {
    return { error: "Invalid or expired link." };
  }

  const parsed = intakeFormSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid form data." };
  }

  const { name, phone, email, emergencyContactName, emergencyContactPhone, emergencyContactRelation, dietaryRestrictions, includePhoneOnCallSheet, includeEmailOnCallSheet } = parsed.data;

  // Build update: only overwrite fields that have non-empty values
  const update: Record<string, string | boolean> = {};
  if (name) update.name = name;
  if (phone) update.phone = phone;
  if (email) update.email = email;
  if (emergencyContactName) update.emergencyContactName = emergencyContactName;
  if (emergencyContactPhone) update.emergencyContactPhone = emergencyContactPhone;
  if (emergencyContactRelation) update.emergencyContactRelation = emergencyContactRelation;
  if (dietaryRestrictions) update.dietaryRestrictions = dietaryRestrictions;
  if (includePhoneOnCallSheet !== undefined) update.includePhoneOnCallSheet = includePhoneOnCallSheet;
  if (includeEmailOnCallSheet !== undefined) update.includeEmailOnCallSheet = includeEmailOnCallSheet;

  if (castMember) {
    // For cast members, update actorName instead of name (name = role name)
    const castUpdate: Record<string, string | boolean> = { ...update };
    if (name) {
      castUpdate.actorName = name;
      delete castUpdate.name;
    }
    await prisma.castMember.update({
      where: { id: castMember.id },
      data: castUpdate,
    });
  } else {
    await prisma.crewMember.update({
      where: { id: crewMember!.id },
      data: update,
    });
  }

  return {};
}
