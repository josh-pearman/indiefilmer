import path from "path";
import { readdir, stat } from "fs/promises";

/** Default per-project storage quota: 500 MB */
const DEFAULT_QUOTA_MB = 500;

const QUOTA_BYTES = (parseInt(process.env.PROJECT_STORAGE_QUOTA_MB ?? "", 10) || DEFAULT_QUOTA_MB) * 1024 * 1024;

/**
 * Recursively calculate the total size of a directory in bytes.
 * Returns 0 if the directory does not exist.
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let total = 0;
  let entries;
  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0; // directory doesn't exist yet
  }
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await getDirectorySize(fullPath);
    } else {
      try {
        const s = await stat(fullPath);
        total += s.size;
      } catch {
        // skip inaccessible files
      }
    }
  }
  return total;
}

/**
 * Get the current storage usage for a project in bytes.
 */
export async function getProjectStorageUsage(projectId: string): Promise<number> {
  const uploadsDir = path.join(process.cwd(), "data/uploads", projectId);
  return getDirectorySize(uploadsDir);
}

/**
 * Get the configured storage quota in bytes.
 */
export function getStorageQuotaBytes(): number {
  return QUOTA_BYTES;
}

export type QuotaCheckResult =
  | { allowed: true; usedBytes: number; quotaBytes: number }
  | { allowed: false; usedBytes: number; quotaBytes: number; error: string };

/**
 * Check if a project has enough storage quota remaining for a file of the given size.
 */
export async function checkStorageQuota(
  projectId: string,
  fileSizeBytes: number
): Promise<QuotaCheckResult> {
  const usedBytes = await getProjectStorageUsage(projectId);
  const quotaBytes = QUOTA_BYTES;

  if (usedBytes + fileSizeBytes > quotaBytes) {
    const usedMB = (usedBytes / (1024 * 1024)).toFixed(1);
    const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);
    return {
      allowed: false,
      usedBytes,
      quotaBytes,
      error: `Storage quota exceeded. Project is using ${usedMB} MB of ${quotaMB} MB. Free up space or contact your administrator.`
    };
  }

  return { allowed: true, usedBytes, quotaBytes };
}
