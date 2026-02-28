"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { validateFileSize } from "@/lib/file-validation";
import { checkStorageQuota } from "@/lib/storage-quota";
import {
  createScriptVersionSchema,
  updateScriptVersionSchema
} from "@/lib/validators";

import { type ActionResult } from "@/lib/action-result";

function getScriptsDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "scripts");
}

const ALLOWED_EXTENSIONS = [".pdf", ".fdx", ".fountain", ".txt", ".docx"];

function sanitizeScriptFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "script";
}

function parsePageCount(value: FormDataEntryValue | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function createScriptVersion(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("script");
  const projectId = await requireCurrentProjectId();
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "A file is required" };
  }
  const originalName = file.name ?? "script";
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      error: `File type not allowed. Use one of: ${ALLOWED_EXTENSIONS.join(", ")}`
    };
  }

  const sizeValidation = validateFileSize(file, "scripts");
  if (!sizeValidation.valid) return { error: sizeValidation.error };

  const quotaCheck = await checkStorageQuota(projectId, file.size);
  if (!quotaCheck.allowed) return { error: quotaCheck.error };

  const raw = {
    versionLabel: (formData.get("versionLabel") as string)?.trim() ?? "",
    pageCount: formData.get("pageCount") ?? "",
    notes: (formData.get("notes") as string) ?? "",
    setAsCurrent: formData.get("setAsCurrent") ?? undefined
  };
  const parsed = createScriptVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const setAsCurrent = parsed.data.setAsCurrent === "on";
  const performedBy = await getPerformedBy();

  const scriptsDir = getScriptsDir(projectId);
  await mkdir(scriptsDir, { recursive: true });

  const id = crypto.randomUUID?.() ?? `sv-${Date.now()}`;
  const safeName = sanitizeScriptFilename(originalName);
  const storedFilename = `${id}-${safeName}`;
  const filePath = path.join(scriptsDir, storedFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const pageCount = parsePageCount(formData.get("pageCount"));

  await prisma.$transaction(async (tx) => {
    if (setAsCurrent) {
      await tx.scriptVersion.updateMany({
        where: { projectId },
        data: { isCurrent: false }
      });
    }
    await tx.scriptVersion.create({
      data: {
        id,
        projectId,
        versionName: parsed.data.versionLabel,
        filePath: storedFilename,
        fileName: originalName,
        pageCount,
        notes: parsed.data.notes || null,
        isCurrent: setAsCurrent,
        uploadedBy: performedBy
      }
    });
  });

  const after = await prisma.scriptVersion.findUnique({
    where: { id }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "ScriptVersion",
    entityId: id,
    after: after ?? undefined,
    changeNote: `Script version "${parsed.data.versionLabel}" uploaded`,
    performedBy
  });

  revalidatePath("/script/hub");
  revalidatePath("/");
  return {};
}

export async function updateScriptVersion(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("script");
  const projectId = await requireCurrentProjectId();
  const raw = {
    id,
    versionLabel: (formData.get("versionLabel") as string)?.trim() ?? "",
    pageCount: formData.get("pageCount") ?? "",
    notes: (formData.get("notes") as string) ?? ""
  };
  const parsed = updateScriptVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const pageCount = parsePageCount(formData.get("pageCount"));

  const before = await prisma.scriptVersion.findUnique({
    where: { id }
  });
  if (!before || before.projectId !== projectId) return { error: "Script version not found" };

  const after = await prisma.scriptVersion.update({
    where: { id },
    data: {
      versionName: parsed.data.versionLabel,
      pageCount,
      notes: parsed.data.notes || null
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "ScriptVersion",
    entityId: id,
    before: { versionName: before.versionName, pageCount: before.pageCount, notes: before.notes },
    after: { versionName: after.versionName, pageCount: after.pageCount, notes: after.notes },
    changeNote: `Script version "${after.versionName}" updated`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/hub");
  revalidatePath("/");
  return {};
}

export async function setCurrentScriptVersion(id: string): Promise<ActionResult> {
  await requireSectionAccess("script");
  const projectId = await requireCurrentProjectId();
  const version = await prisma.scriptVersion.findUnique({
    where: { id, isDeleted: false }
  });
  if (!version || version.projectId !== projectId) return { error: "Script version not found" };

  const beforeCurrent = await prisma.scriptVersion.findFirst({
    where: { projectId, isCurrent: true }
  });

  await prisma.$transaction(async (tx) => {
    await tx.scriptVersion.updateMany({
      where: { projectId },
      data: { isCurrent: false }
    });
    await tx.scriptVersion.update({
      where: { id },
      data: { isCurrent: true }
    });
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "ScriptVersion",
    entityId: id,
    before: beforeCurrent ? { isCurrent: beforeCurrent.id } : undefined,
    after: { isCurrent: id },
    changeNote: `Set current script to "${version.versionName}"`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/hub");
  revalidatePath("/");
  return {};
}

export async function deleteScriptVersion(id: string): Promise<ActionResult> {
  await requireSectionAccess("script");
  const projectId = await requireCurrentProjectId();
  const version = await prisma.scriptVersion.findUnique({
    where: { id }
  });
  if (!version || version.projectId !== projectId) return { error: "Script version not found" };
  if (version.isCurrent) {
    return {
      error:
        "Cannot delete the current draft. Set another version as current first."
    };
  }

  const before = { ...version };
  await prisma.scriptVersion.update({
    where: { id },
    data: { isDeleted: true }
  });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "ScriptVersion",
    entityId: id,
    before,
    changeNote: `Script version "${version.versionName}" deleted`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/hub");
  revalidatePath("/");
  return {};
}

export async function restoreScriptVersion(id: string): Promise<ActionResult> {
  await requireSectionAccess("script");
  const projectId = await requireCurrentProjectId();
  const version = await prisma.scriptVersion.findUnique({
    where: { id }
  });
  if (!version || version.projectId !== projectId) return { error: "Script version not found" };

  await prisma.scriptVersion.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "ScriptVersion",
    entityId: id,
    after: { ...version, isDeleted: false },
    changeNote: `Script version "${version.versionName}" restored`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/hub");
  revalidatePath("/");
  return {};
}
