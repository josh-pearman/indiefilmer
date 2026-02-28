import path from "path";

/**
 * Allowed file extensions by upload type.
 * Each type maps to a set of lowercase extensions (including the dot).
 */
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  scripts: [".pdf", ".fdx", ".fountain", ".txt", ".docx"],
  images: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  documents: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".md"],
  receipts: [".jpg", ".jpeg", ".png", ".pdf"],
  // General: images + documents combined (for notes, tasks, locations)
  general: [
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".md",
    ".zip",
  ],
};

/**
 * MIME types that are acceptable for each extension.
 * Used to cross-check the browser-reported MIME type against the file extension.
 */
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".zip": ["application/zip", "application/x-zip-compressed"],
  ".fdx": ["application/xml", "text/xml", "application/octet-stream"],
  ".fountain": ["text/plain", "application/octet-stream"],
};

/**
 * Maximum file sizes (in bytes) by upload type.
 */
const MAX_FILE_SIZES: Record<string, number> = {
  scripts: 10 * 1024 * 1024,       // 10 MB
  images: 5 * 1024 * 1024,          // 5 MB
  receipts: 5 * 1024 * 1024,        // 5 MB
  general: 10 * 1024 * 1024,        // 10 MB (notes, tasks, locations, shotlists)
};

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate a file's extension and MIME type against an allowed set.
 *
 * @param file - The uploaded File object
 * @param type - The upload type key (scripts, images, documents, receipts, general)
 * @returns Validation result with error message if invalid
 */
export function validateFileType(
  file: File,
  type: keyof typeof ALLOWED_EXTENSIONS = "general"
): FileValidationResult {
  const allowedExts = ALLOWED_EXTENSIONS[type];
  if (!allowedExts) {
    return { valid: false, error: "Unknown upload type." };
  }

  const ext = path.extname(file.name || "").toLowerCase();
  if (!ext) {
    return { valid: false, error: "File must have an extension." };
  }

  if (!allowedExts.includes(ext)) {
    return {
      valid: false,
      error: `File type "${ext}" not allowed. Accepted: ${allowedExts.join(", ")}`,
    };
  }

  // Cross-check MIME type if the browser provided one
  const mimeTypes = EXTENSION_MIME_MAP[ext];
  if (mimeTypes && file.type && !mimeTypes.includes(file.type) && file.type !== "application/octet-stream") {
    return {
      valid: false,
      error: `File content type "${file.type}" does not match extension "${ext}".`,
    };
  }

  return { valid: true };
}

/**
 * Validate a file's size against the limit for its upload type.
 *
 * @param file - The uploaded File object
 * @param type - The upload type key (scripts, images, receipts, general)
 * @returns Validation result with error message if file is too large
 */
export function validateFileSize(
  file: File,
  type: keyof typeof MAX_FILE_SIZES = "general"
): FileValidationResult {
  const maxSize = MAX_FILE_SIZES[type];
  if (!maxSize) {
    return { valid: false, error: "Unknown upload type." };
  }

  if (file.size > maxSize) {
    const limitMB = (maxSize / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${fileMB} MB). Maximum allowed size is ${limitMB} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Get the allowed extensions for a given upload type (for error messages / UI hints).
 */
export function getAllowedExtensions(type: keyof typeof ALLOWED_EXTENSIONS = "general"): string[] {
  return ALLOWED_EXTENSIONS[type] ?? [];
}
