"use server";

import { revalidatePath } from "next/cache";
import path from "path";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { validateFileType, validateFileSize } from "@/lib/file-validation";
import { checkStorageQuota } from "@/lib/storage-quota";
import {
  createNoteSchema,
  updateNoteSchema,
  noteLinkSchema,
  convertNoteToTaskSchema
} from "@/lib/validators";

import { ActionResult as BaseActionResult } from "@/lib/action-result";
export type ActionResult = BaseActionResult & { noteId?: string; filePath?: string };
export type ConvertResult = { error?: string; taskId?: string };

function getNotesUploadDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "notes");
}

function getTasksUploadDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "tasks");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

function stripMarkdownImages(content: string | null): string | null {
  if (!content) return null;

  const withoutImages = content
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return withoutImages || null;
}

type MarkdownImageRef = {
  alt: string;
  src: string;
};

function extractMarkdownImages(content: string | null): MarkdownImageRef[] {
  if (!content) return [];

  const matches = content.matchAll(/!\[([^\]]*)]\((\S+?)(?:\s+"[^"]+")?\)/g);
  const images: MarkdownImageRef[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const alt = match[1]?.trim() || "image";
    const src = match[2]?.trim();
    if (!src || seen.has(src)) continue;
    seen.add(src);
    images.push({ alt, src });
  }

  return images;
}

function getTaskFileNameFromUrl(
  url: string,
  fallbackAlt: string,
  contentType?: string | null
): string {
  try {
    const parsed = new URL(url);
    const pathnameName = path.basename(parsed.pathname);
    if (pathnameName && pathnameName !== "/") {
      return decodeURIComponent(pathnameName);
    }
  } catch {
    // ignore invalid URL and fall back
  }

  const safeAlt = sanitizeFilename(fallbackAlt || "image");
  const extension = getExtensionFromContentType(contentType);
  return extension ? `${safeAlt}${extension}` : safeAlt;
}

function getExtensionFromContentType(contentType?: string | null): string {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  switch (type) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/gif":
      return ".gif";
    case "image/webp":
      return ".webp";
    case "image/svg+xml":
      return ".svg";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}

export async function createNote(formData: FormData): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const raw = {
    title: formData.get("title"),
    category: (formData.get("category") as string) ?? "",
    body: (formData.get("body") as string) ?? ""
  };
  const parsed = createNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const performedBy = await getPerformedBy();
  const note = await prisma.note.create({
    data: {
      projectId,
      title: parsed.data.title,
      category: parsed.data.category?.trim() || null,
      body: parsed.data.body?.trim() || null,
      createdBy: performedBy
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Note",
    entityId: note.id,
    after: note,
    changeNote: `Note "${note.title}" created`,
    performedBy
  });

  revalidatePath("/production/notes");
  revalidatePath("/");
  return { noteId: note.id };
}

export async function updateNote(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.note.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Note not found" };

  const raw = {
    id,
    title: formData.get("title"),
    category: (formData.get("category") as string) ?? "",
    body: (formData.get("body") as string) ?? ""
  };
  const parsed = updateNoteSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const afterRecord = await prisma.note.update({
    where: { id },
    data: {
      title: data.title ?? before.title,
      category: data.category !== undefined ? (data.category?.trim() || null) : undefined,
      body: data.body !== undefined ? (data.body?.trim() || null) : undefined
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Note",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath(`/production/notes/${id}`);
  revalidatePath("/");
  return {};
}

export async function addNoteLink(
  noteId: string,
  label: string,
  url: string
): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const parsed = noteLinkSchema.safeParse({ noteId, label, url });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const note = await prisma.note.findFirst({ where: { id: noteId, projectId } });
  if (!note) return { error: "Note not found" };

  const link = await prisma.noteLink.create({
    data: {
      noteId: parsed.data.noteId,
      label: parsed.data.label,
      url: parsed.data.url
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Note",
    entityId: noteId,
    after: { linkId: link.id, label: link.label, url: link.url },
    changeNote: `Link "${link.label}" added to note`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath(`/production/notes/${noteId}`);
  revalidatePath("/");
  return {};
}

export async function removeNoteLink(linkId: string): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const link = await prisma.noteLink.findUnique({
    where: { id: linkId },
    include: { note: true }
  });
  if (!link || link.note.projectId !== projectId) return { error: "Link not found" };

  await prisma.noteLink.delete({ where: { id: linkId } });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Note",
    entityId: link.noteId,
    before: { linkId: link.id, label: link.label },
    changeNote: `Link "${link.label}" removed from note`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath(`/production/notes/${link.noteId}`);
  revalidatePath("/");
  return {};
}

export async function addNoteFile(
  noteId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const note = await prisma.note.findFirst({ where: { id: noteId, projectId } });
  if (!note) return { error: "Note not found" };

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "A file is required" };
  }

  const validation = validateFileType(file, "general");
  if (!validation.valid) return { error: validation.error };

  const sizeValidation = validateFileSize(file, "general");
  if (!sizeValidation.valid) return { error: sizeValidation.error };

  const quotaCheck = await checkStorageQuota(projectId, file.size);
  if (!quotaCheck.allowed) return { error: quotaCheck.error };

  const originalName = file.name ?? "file";
  const safeName = sanitizeFilename(originalName);
  const id = crypto.randomUUID?.() ?? `nf-${Date.now()}`;
  const storedFilename = `${noteId}-${id}-${safeName}`;
  const notesUploadDir = getNotesUploadDir(projectId);
  const filePath = path.join(notesUploadDir, storedFilename);

  await mkdir(notesUploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const noteFile = await prisma.noteFile.create({
    data: {
      noteId,
      filePath: storedFilename,
      fileName: originalName
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Note",
    entityId: noteId,
    after: { fileId: noteFile.id, fileName: originalName },
    changeNote: `File "${originalName}" attached to note`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath(`/production/notes/${noteId}`);
  revalidatePath("/");
  return { filePath: storedFilename };
}

export async function removeNoteFile(fileId: string): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const noteFile = await prisma.noteFile.findUnique({
    where: { id: fileId },
    include: { note: true }
  });
  if (!noteFile || noteFile.note.projectId !== projectId) return { error: "File not found" };

  const fullPath = path.join(getNotesUploadDir(projectId), noteFile.filePath);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing file
  }

  await prisma.noteFile.delete({ where: { id: fileId } });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Note",
    entityId: noteFile.noteId,
    before: { fileId: noteFile.id, fileName: noteFile.fileName },
    changeNote: `File "${noteFile.fileName}" removed from note`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath(`/production/notes/${noteFile.noteId}`);
  revalidatePath("/");
  return {};
}

export async function convertNoteToTask(
  noteId: string,
  formData: FormData
): Promise<ConvertResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const raw = {
    noteId,
    title: formData.get("title"),
    owner: (formData.get("owner") as string) ?? "",
    dueDate: (formData.get("dueDate") as string) ?? ""
  };
  const submitRaw = {
    ...raw,
    owner: raw.owner === "" ? undefined : raw.owner
  };
  const parsed = convertNoteToTaskSchema.safeParse(submitRaw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    include: { files: true, links: true }
  });
  if (!note || note.projectId !== projectId) return { error: "Note not found" };

  const performedBy = await getPerformedBy();
  const dueDateVal =
    parsed.data.dueDate && parsed.data.dueDate.trim()
      ? new Date(parsed.data.dueDate)
      : null;

  const task = await prisma.task.create({
    data: {
      projectId,
      title: parsed.data.title,
      owner: parsed.data.owner === "" ? null : (parsed.data.owner ?? null),
      status: "Todo",
      dueDate: dueDateVal,
      notes: stripMarkdownImages(note.body),
      sourceNoteId: note.id
    }
  });

  const notesUploadDir = getNotesUploadDir(projectId);
  const tasksUploadDir = getTasksUploadDir(projectId);
  await mkdir(tasksUploadDir, { recursive: true });

  // Pre-check quota before copying note files to task
  const estimatedSize = note.files.reduce((sum, f) => sum + 1024 * 1024, 0); // conservative 1MB per file
  const quotaCheck = await checkStorageQuota(projectId, estimatedSize);
  // Don't block task creation on quota — just skip file copy if over quota
  const skipFileCopy = !quotaCheck.allowed;

  const markdownImages = extractMarkdownImages(note.body);
  const fileSources = new Map<
    string,
    { filePath: string; fileName: string }
  >();
  const remoteImages = new Map<string, { src: string; alt: string }>();

  for (const nf of note.files) {
    fileSources.set(nf.filePath, {
      filePath: nf.filePath,
      fileName: nf.fileName,
    });
  }

  for (const image of markdownImages) {
    if (image.src.startsWith("/api/note-files/")) {
      const filePath = decodeURIComponent(
        image.src.replace("/api/note-files/", "")
      );

      if (!fileSources.has(filePath)) {
        fileSources.set(filePath, {
          filePath,
          fileName: path.basename(filePath),
        });
      }
      continue;
    }

    if (/^https?:\/\//i.test(image.src) && !remoteImages.has(image.src)) {
      remoteImages.set(image.src, image);
    }
  }

  if (!skipFileCopy) {
    for (const fileSource of fileSources.values()) {
      const srcPath = path.join(notesUploadDir, fileSource.filePath);
      const fileId = crypto.randomUUID?.() ?? `tf-${Date.now()}`;
      const safeName = sanitizeFilename(fileSource.fileName);
      const storedFilename = `${task.id}-${fileId}-${safeName}`;
      const destPath = path.join(tasksUploadDir, storedFilename);
      try {
        const buf = await readFile(srcPath);
        await writeFile(destPath, buf);
        await prisma.taskFile.create({
          data: {
            taskId: task.id,
            filePath: storedFilename,
            fileName: fileSource.fileName
          }
        });
      } catch {
        // skip file copy on error
      }
    }

    for (const image of remoteImages.values()) {
      try {
        const response = await fetch(image.src);
        if (!response.ok) continue;

        const contentType = response.headers.get("content-type");
        const originalName = getTaskFileNameFromUrl(image.src, image.alt, contentType);
        const safeName = sanitizeFilename(originalName);
        const fileId = crypto.randomUUID?.() ?? `tf-${Date.now()}`;
        const storedFilename = `${task.id}-${fileId}-${safeName}`;
        const destPath = path.join(tasksUploadDir, storedFilename);
        const buffer = Buffer.from(await response.arrayBuffer());

        await writeFile(destPath, buffer);
        await prisma.taskFile.create({
          data: {
            taskId: task.id,
            filePath: storedFilename,
            fileName: originalName,
          },
        });
      } catch {
        // skip remote image import on error
      }
    }
  }

  if (note.links.length > 0) {
    await prisma.taskLink.createMany({
      data: note.links.map((nl) => ({
        taskId: task.id,
        label: nl.label,
        url: nl.url
      }))
    });
  }

  await logAudit({
    projectId,
    action: "update",
    entityType: "Note",
    entityId: note.id,
    after: { convertedToTaskId: task.id },
    changeNote: "Converted to Task",
    performedBy
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Task",
    entityId: task.id,
    after: { sourceNoteId: note.id, title: task.title },
    changeNote: "Created from Note",
    performedBy
  });

  revalidatePath("/production/notes");
  revalidatePath(`/production/notes/${noteId}`);
  revalidatePath("/production/tasks");
  revalidatePath("/");
  return { taskId: task.id };
}

export async function deleteNote(id: string): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.note.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Note not found" };

  await prisma.note.update({
    where: { id },
    data: { isDeleted: true }
  });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "Note",
    entityId: id,
    before,
    changeNote: "Note soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath("/");
  return {};
}

export async function restoreNote(id: string): Promise<ActionResult> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.note.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Note not found" };

  const afterRecord = await prisma.note.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "Note",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Note restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/notes");
  revalidatePath("/");
  return {};
}

export async function getNoteCategories(): Promise<string[]> {
  await requireSectionAccess("notes");
  const projectId = await requireCurrentProjectId();
  const rows = await prisma.note.findMany({
    where: { projectId, isDeleted: false, category: { not: null } },
    select: { category: true },
    distinct: ["category"]
  });
  const categories = rows
    .map((r) => r.category)
    .filter((c): c is string => c != null && c.trim() !== "");
  return [...new Set(categories)].sort();
}
