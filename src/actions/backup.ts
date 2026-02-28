'use server';

import { revalidatePath } from "next/cache";
import { createProjectBackup } from "@/lib/backup";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";

export async function createBackupAction(): Promise<{ path?: string; error?: string }> {
  await requireSectionAccess("settings");
  const projectId = await requireCurrentProjectId();
  try {
    const backupPath = await createProjectBackup(projectId);
    revalidatePath("/settings");
    return { path: backupPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Backup failed: ${message}` };
  }
}
