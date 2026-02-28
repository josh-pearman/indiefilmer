"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readdir, stat, rm, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  updateProjectSettingsSchema,
  resetProjectSchema,
  updateCraftServicesDefaultsSchema
} from "@/lib/validators";
import { createLogger } from "@/lib/logger";
import { getProjectStorageUsage, getStorageQuotaBytes } from "@/lib/storage-quota";

const logger = createLogger("settings");

import { type ActionResult } from "@/lib/action-result";

const BUCKET_NAMES = [
  "Locations",
  "Food",
  "Gear",
  "Talent",
  "Crew",
  "Transport",
  "Post",
  "Misc"
];

export async function updateProjectSettings(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const raw = {
    projectName: formData.get("projectName") as string | null,
    totalBudget: formData.get("totalBudget")
      ? Number(formData.get("totalBudget"))
      : undefined,
    currencySymbol: (formData.get("currencySymbol") as string) || undefined
  };
  const parsed = updateProjectSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const payload: Record<string, unknown> = {};
  if (data.projectName !== undefined) payload.projectName = data.projectName;
  if (data.totalBudget !== undefined) payload.totalBudget = data.totalBudget;
  if (data.currencySymbol !== undefined)
    payload.currencySymbol = data.currencySymbol;

  if (Object.keys(payload).length === 0) return {};

  const before = await prisma.projectSettings.findUnique({
    where: { projectId }
  });
  await prisma.projectSettings.update({
    where: { projectId },
    data: payload as Parameters<typeof prisma.projectSettings.update>[0]["data"]
  });
  await logAudit({
    projectId,
    action: "update",
    entityType: "ProjectSettings",
    entityId: projectId,
    before,
    after: payload,
    changeNote: "Project settings updated",
    performedBy: await getPerformedBy()
  });
  revalidatePath("/settings");
  revalidatePath("/accounting/budget");
  revalidatePath("/");
  return {};
}

export async function updateCraftServicesDefaults(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("settings");
  const raw = {
    craftyPerPerson: formData.get("craftyPerPerson")
      ? Number(formData.get("craftyPerPerson"))
      : undefined,
    lunchPerPerson: formData.get("lunchPerPerson")
      ? Number(formData.get("lunchPerPerson"))
      : undefined,
    dinnerPerPerson: formData.get("dinnerPerPerson")
      ? Number(formData.get("dinnerPerPerson"))
      : undefined,
    craftyEnabledByDefault: formData.has("craftyEnabledByDefault"),
    lunchEnabledByDefault: formData.has("lunchEnabledByDefault"),
    dinnerEnabledByDefault: formData.has("dinnerEnabledByDefault")
  };
  const parsed = updateCraftServicesDefaultsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const payload = {
    craftyPerPerson: data.craftyPerPerson,
    lunchPerPerson: data.lunchPerPerson,
    dinnerPerPerson: data.dinnerPerPerson,
    craftyEnabledByDefault: data.craftyEnabledByDefault,
    lunchEnabledByDefault: data.lunchEnabledByDefault,
    dinnerEnabledByDefault: data.dinnerEnabledByDefault
  };

  const projectId = await requireCurrentProjectId();
  const before = await prisma.projectSettings.findUnique({
    where: { projectId }
  });
  await prisma.projectSettings.update({
    where: { projectId },
    data: payload
  });
  await logAudit({
    projectId,
    action: "update",
    entityType: "ProjectSettings",
    entityId: projectId,
    before,
    after: payload,
    changeNote: "Craft services defaults updated",
    performedBy: await getPerformedBy()
  });
  revalidatePath("/settings");
  revalidatePath("/production/catering");
  revalidatePath("/production/schedule");
  revalidatePath("/");
  return {};
}

export async function updateUserTheme(theme: string): Promise<ActionResult> {
  await requireSectionAccess("settings");
  const allowed = ["light", "dark", "warm"];
  if (!allowed.includes(theme)) return { error: "Invalid theme" };

  const userId = await getSessionUser();
  if (!userId) return { error: "Not logged in" };

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { colorTheme: true }
  });
  await prisma.user.update({
    where: { id: userId },
    data: { colorTheme: theme }
  });
  await logAudit({
    action: "update",
    entityType: "User",
    entityId: userId,
    before,
    after: { colorTheme: theme },
    changeNote: `Theme set to ${theme}`,
    performedBy: await getPerformedBy()
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return {};
}

export async function purgeDeletedRecords(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  try {
    const [
      scenes,
      cast,
      crew,
      locations,
      shootDays,
      tasks,
      lineItems,
      scriptVersions,
      vaultFiles,
      notes
    ] = await Promise.all([
      prisma.scene.count({ where: { projectId, isDeleted: true } }),
      prisma.castMember.count({ where: { projectId, isDeleted: true } }),
      prisma.crewMember.count({ where: { projectId, isDeleted: true } }),
      prisma.location.count({ where: { projectId, isDeleted: true } }),
      prisma.shootDay.count({ where: { projectId, isDeleted: true } }),
      prisma.task.count({ where: { projectId, isDeleted: true } }),
      prisma.budgetLineItem.count({ where: { projectId, isDeleted: true } }),
      prisma.scriptVersion.count({ where: { projectId, isDeleted: true } }),
      prisma.vaultFile.count({ where: { projectId, isDeleted: true } }),
      prisma.note.count({ where: { projectId, isDeleted: true } })
    ]);

    const totalCount =
      scenes +
      cast +
      crew +
      locations +
      shootDays +
      tasks +
      lineItems +
      scriptVersions +
      vaultFiles +
      notes;

    if (totalCount === 0) {
      return { success: true, count: 0 };
    }

    const shotlistsDir = path.join(process.cwd(), "data/uploads", projectId, "shotlists");
    const deletedScenesWithShotlists = await prisma.scene.findMany({
      where: { projectId, isDeleted: true, shotlistPath: { not: null } },
      select: { shotlistPath: true }
    });
    for (const s of deletedScenesWithShotlists) {
      if (s.shotlistPath) {
        try {
          await unlink(path.join(shotlistsDir, s.shotlistPath));
        } catch {
          // ignore missing file
        }
      }
    }

    const scriptsDir = path.join(process.cwd(), "data/uploads", projectId, "scripts");
    const deletedScriptVersions = await prisma.scriptVersion.findMany({
      where: { projectId, isDeleted: true },
      select: { filePath: true }
    });
    for (const sv of deletedScriptVersions) {
      if (sv.filePath) {
        try {
          const fullPath = path.isAbsolute(sv.filePath)
            ? sv.filePath
            : path.join(scriptsDir, sv.filePath);
          await unlink(fullPath);
        } catch {
          // ignore missing file
        }
      }
    }

    const tasksDir = path.join(process.cwd(), "data/uploads", projectId, "tasks");
    const deletedTaskFiles = await prisma.taskFile.findMany({
      where: { task: { projectId, isDeleted: true } },
      select: { filePath: true }
    });
    for (const tf of deletedTaskFiles) {
      try {
        await unlink(path.join(tasksDir, tf.filePath));
      } catch {
        // ignore missing file
      }
    }

    const notesDir = path.join(process.cwd(), "data/uploads", projectId, "notes");
    const deletedNoteFiles = await prisma.noteFile.findMany({
      where: { note: { projectId, isDeleted: true } },
      select: { filePath: true }
    });
    for (const nf of deletedNoteFiles) {
      try {
        await unlink(path.join(notesDir, nf.filePath));
      } catch {
        // ignore missing file
      }
    }

    await prisma.budgetLineItem.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.sceneTag.deleteMany({
      where: { scene: { projectId, isDeleted: true } }
    });
    await prisma.sceneCast.deleteMany({
      where: { scene: { projectId, isDeleted: true } }
    });
    await prisma.shootDayScene.deleteMany({
      where: { scene: { projectId, isDeleted: true } }
    });
    await prisma.scene.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.shootDayMeal.deleteMany({
      where: { shootDay: { projectId, isDeleted: true } }
    });
    await prisma.gearItemDay.deleteMany({
      where: { shootDay: { projectId, isDeleted: true } }
    });
    const callSheets = await prisma.callSheet.findMany({
      where: { shootDay: { projectId, isDeleted: true } },
      select: { id: true }
    });
    for (const cs of callSheets) {
      await prisma.callSheet.delete({ where: { id: cs.id } });
    }
    await prisma.shootDayScene.deleteMany({
      where: { shootDay: { projectId, isDeleted: true } }
    });
    await prisma.shootDayCrew.deleteMany({
      where: { shootDay: { projectId, isDeleted: true } }
    });
    await prisma.shootDay.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.castMember.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.crewMember.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.location.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.task.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.scriptVersion.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.vaultFile.deleteMany({ where: { projectId, isDeleted: true } });
    await prisma.note.deleteMany({ where: { projectId, isDeleted: true } });

    await logAudit({
      projectId,
      action: "delete",
      entityType: "System",
      entityId: "purge",
      changeNote: `Permanently purged ${totalCount} soft-deleted records`,
      performedBy: await getPerformedBy()
    });

    revalidatePath("/settings");
    revalidatePath("/");
    return { success: true, count: totalCount };
  } catch (err) {
    logger.error("Failed to purge deleted records", {
      action: "purgeDeletedRecords",
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      count: 0,
      error: err instanceof Error ? err.message : "Purge failed"
    };
  }
}

export async function getDeletedCounts(): Promise<Record<string, number>> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const [
    scenes,
    cast,
    crew,
    locations,
    shootDays,
    tasks,
    lineItems,
    scriptVersions,
    vaultFiles,
    notes
  ] = await Promise.all([
    prisma.scene.count({ where: { projectId, isDeleted: true } }),
    prisma.castMember.count({ where: { projectId, isDeleted: true } }),
    prisma.crewMember.count({ where: { projectId, isDeleted: true } }),
    prisma.location.count({ where: { projectId, isDeleted: true } }),
    prisma.shootDay.count({ where: { projectId, isDeleted: true } }),
    prisma.task.count({ where: { projectId, isDeleted: true } }),
    prisma.budgetLineItem.count({ where: { projectId, isDeleted: true } }),
    prisma.scriptVersion.count({ where: { projectId, isDeleted: true } }),
    prisma.vaultFile.count({ where: { projectId, isDeleted: true } }),
    prisma.note.count({ where: { projectId, isDeleted: true } })
  ]);
  return {
    scenes,
    cast,
    crew,
    locations,
    shootDays,
    tasks,
    lineItems,
    scriptVersions,
    vaultFiles,
    notes
  };
}

export async function resetProject(
  confirmationName: string
): Promise<ActionResult> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const parsed = resetProjectSchema.safeParse({ confirmationName });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId }
  });
  const projectName = settings?.projectName ?? "Untitled Project";
  if (parsed.data.confirmationName.trim() !== projectName.trim()) {
    return { error: "Confirmation text does not match project name" };
  }

  const projectRoot = process.cwd();
  const uploadsDir = path.join(projectRoot, "data", "uploads", projectId);

  await prisma.gearItemDay.deleteMany({
    where: { shootDay: { projectId } }
  });
  await prisma.gearItem.deleteMany({
    where: { gearModel: { projectId } }
  });
  await prisma.gearModel.deleteMany({ where: { projectId } });
  await prisma.shootDayMeal.deleteMany({
    where: { shootDay: { projectId } }
  });
  await prisma.shootDayScene.deleteMany({
    where: { shootDay: { projectId } }
  });
  await prisma.shootDayCrew.deleteMany({
    where: { shootDay: { projectId } }
  });
  const callSheets = await prisma.callSheet.findMany({
    where: { shootDay: { projectId } },
    select: { id: true }
  });
  for (const cs of callSheets) await prisma.callSheet.delete({ where: { id: cs.id } });
  await prisma.shootDay.deleteMany({ where: { projectId } });
  await prisma.sceneTag.deleteMany({
    where: { scene: { projectId } }
  });
  await prisma.sceneCast.deleteMany({
    where: { scene: { projectId } }
  });
  await prisma.scene.deleteMany({ where: { projectId } });
  await prisma.castMember.deleteMany({ where: { projectId } });
  await prisma.crewMember.deleteMany({ where: { projectId } });
  await prisma.location.deleteMany({ where: { projectId } });
  await prisma.budgetLineItem.deleteMany({ where: { projectId } });
  await prisma.budgetBucket.deleteMany({ where: { projectId } });
  const taskFiles = await prisma.taskFile.findMany({
    where: { task: { projectId } },
    select: { filePath: true }
  });
  const tasksDir = path.join(uploadsDir, "tasks");
  for (const tf of taskFiles) {
    try {
      await unlink(path.join(tasksDir, tf.filePath));
    } catch {
      // ignore
    }
  }
  await prisma.task.deleteMany({ where: { projectId } });
  const noteFiles = await prisma.noteFile.findMany({
    where: { note: { projectId } },
    select: { filePath: true }
  });
  const notesDir = path.join(uploadsDir, "notes");
  for (const nf of noteFiles) {
    try {
      await unlink(path.join(notesDir, nf.filePath));
    } catch {
      // ignore
    }
  }
  await prisma.note.deleteMany({ where: { projectId } });
  await prisma.vaultFile.deleteMany({ where: { projectId } });
  await prisma.scriptVersion.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });

  for (const name of BUCKET_NAMES) {
    await prisma.budgetBucket.create({
      data: { projectId, name, plannedAmount: 0 }
    });
  }

  await prisma.projectSettings.update({
    where: { projectId },
    data: {
      totalBudget: 10000,
      projectName: "Untitled Project",
      currencySymbol: "$",
      craftyPerPerson: 5,
      lunchPerPerson: 12,
      dinnerPerPerson: 12,
      craftyEnabledByDefault: true,
      lunchEnabledByDefault: true,
      dinnerEnabledByDefault: false,
      intakeEmailSubject: null,
      intakeEmailBody: null
    }
  });

  try {
    const uploadsExists = await stat(uploadsDir).then(() => true).catch(() => false);
    if (uploadsExists) {
      const entries = await readdir(uploadsDir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(uploadsDir, e.name);
        if (e.isDirectory()) await rm(full, { recursive: true });
        else await rm(full);
      }
    }
  } catch (e) {
    logger.warn("Could not clear uploads directory", {
      action: "resetProject",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await logAudit({
    projectId,
    action: "create",
    entityType: "System",
    entityId: "reset",
    changeNote: "Project reset to initial state",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function clearActivity(): Promise<{ error?: string }> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  await prisma.auditLog.deleteMany({ where: { projectId } });
  revalidatePath("/");
  return {};
}

export async function listBackups(): Promise<
  Array<{ filename: string; date: string; size: string }>
> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const projectRoot = process.cwd();
  const backupsDir = path.join(projectRoot, "data", "backups", projectId);
  try {
    const files = await readdir(backupsDir);
    const zipFiles = files.filter((f) => f.endsWith(".zip"));
    const withStats = await Promise.all(
      zipFiles.map(async (filename) => {
        const full = path.join(backupsDir, filename);
        const s = await stat(full).catch(() => null);
        const size = s ? formatBytes(s.size) : "—";
        const match = filename.match(/backup-(\d{4}-\d{2}-\d{2}-\d{6})\.zip/);
        const date = match
          ? formatBackupDate(match[1])
          : filename.replace(".zip", "");
        return { filename, date, size };
      })
    );
    withStats.sort((a, b) => b.filename.localeCompare(a.filename));
    return withStats.slice(0, 10);
  } catch {
    return [];
  }
}

export async function getStorageUsage(): Promise<{
  usedBytes: number;
  quotaBytes: number;
  usedFormatted: string;
  quotaFormatted: string;
  percentUsed: number;
}> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  const usedBytes = await getProjectStorageUsage(projectId);
  const quotaBytes = getStorageQuotaBytes();
  return {
    usedBytes,
    quotaBytes,
    usedFormatted: formatBytes(usedBytes),
    quotaFormatted: formatBytes(quotaBytes),
    percentUsed: quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatBackupDate(timestamp: string): string {
  const m = timestamp.match(
    /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/
  );
  if (!m) return timestamp;
  const [, y, mo, d, h, min, s] = m;
  return `${y}-${mo}-${d} ${h}:${min}:${s}`;
}
