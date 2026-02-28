"use server";

import { revalidatePath } from "next/cache";
import path from "path";
import { writeFile, mkdir, unlink } from "fs/promises";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { validateFileType, validateFileSize } from "@/lib/file-validation";
import { checkStorageQuota } from "@/lib/storage-quota";
import { z } from "zod";
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  taskLinkSchema,
  TASK_STATUSES,
  TASK_PRIORITIES
} from "@/lib/validators";
import { syncEntityFromTask } from "@/lib/task-entity-sync";

import { type ActionResult } from "@/lib/action-result";

function getTasksUploadDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "tasks");
}

function sanitizeTaskFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const raw = {
    title: formData.get("title"),
    owner: (formData.get("owner") as string) || undefined,
    status: formData.get("status") ?? "Todo",
    priority: (formData.get("priority") as string) || undefined,
    category: (formData.get("category") as string) || undefined,
    dueDate: (formData.get("dueDate") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
    sourceNoteId: (formData.get("sourceNoteId") as string) || undefined
  };
  if (raw.owner === "") raw.owner = undefined;
  if (raw.sourceNoteId === "") raw.sourceNoteId = undefined;
  const parsed = createTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const dueDateVal = data.dueDate && data.dueDate.trim() ? new Date(data.dueDate) : null;

  // Set position to be after the last task in the same status column
  const lastTask = await prisma.task.findFirst({
    where: { projectId, status: data.status, isDeleted: false },
    orderBy: { position: "desc" },
    select: { position: true }
  });
  const position = (lastTask?.position ?? 0) + 1000;

  const task = await prisma.task.create({
    data: {
      projectId,
      title: data.title,
      owner: data.owner === "" ? null : (data.owner ?? null),
      status: data.status,
      priority: data.priority ?? "none",
      category: data.category === "" ? null : (data.category ?? null),
      position,
      dueDate: dueDateVal,
      notes: data.notes === "" ? null : (data.notes ?? null),
      sourceNoteId: data.sourceNoteId?.trim() || null
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Task",
    entityId: task.id,
    after: task,
    changeNote: `Task "${task.title}" created`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function updateTask(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.task.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Task not found" };

  const raw = {
    id,
    title: formData.get("title"),
    owner: (formData.get("owner") as string | null) ?? undefined,
    status: formData.get("status"),
    priority: (formData.get("priority") as string | null) ?? undefined,
    category: (formData.get("category") as string | null) ?? undefined,
    dueDate: (formData.get("dueDate") as string | null) ?? undefined,
    notes: (formData.get("notes") as string | null) ?? undefined
  };
  const parsed = updateTaskSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const updatePayload: Parameters<typeof prisma.task.update>[0]["data"] = {};
  if (data.title !== undefined) updatePayload.title = data.title;
  if (data.owner !== undefined) updatePayload.owner = data.owner === "" ? null : (data.owner ?? null);
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.priority !== undefined) updatePayload.priority = data.priority;
  if (data.category !== undefined) updatePayload.category = data.category === "" ? null : (data.category ?? null);
  if (data.dueDate !== undefined) {
    updatePayload.dueDate = data.dueDate && data.dueDate.trim() ? new Date(data.dueDate) : null;
  }
  if (data.notes !== undefined) updatePayload.notes = data.notes === "" ? null : (data.notes ?? null);

  const afterRecord = await prisma.task.update({
    where: { id, projectId },
    data: updatePayload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function updateTaskStatus(
  id: string,
  status: string
): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const parsed = updateTaskStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid status" };
  }

  const before = await prisma.task.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Task not found" };

  const afterRecord = await prisma.task.update({
    where: { id, projectId },
    data: { status: parsed.data.status }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: `Status set to ${parsed.data.status}`,
    performedBy: await getPerformedBy()
  });

  await syncEntityFromTask(id, parsed.data.status);

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.task.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Task not found" };

  await prisma.task.update({
    where: { id, projectId },
    data: { isDeleted: true }
  });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "Task",
    entityId: id,
    before,
    changeNote: "Task soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function restoreTask(id: string): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.task.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Task not found" };

  const afterRecord = await prisma.task.update({
    where: { id, projectId },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "Task",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Task restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function addTaskLink(
  taskId: string,
  label: string,
  url: string
): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const parsed = taskLinkSchema.safeParse({ taskId, label, url });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) return { error: "Task not found" };

  const link = await prisma.taskLink.create({
    data: {
      taskId: parsed.data.taskId,
      label: parsed.data.label,
      url: parsed.data.url
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Task",
    entityId: taskId,
    after: { linkId: link.id, label: link.label, url: link.url },
    changeNote: `Link "${link.label}" added to task`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function removeTaskLink(linkId: string): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const link = await prisma.taskLink.findUnique({
    where: { id: linkId },
    include: { task: true }
  });
  if (!link || link.task.projectId !== projectId) return { error: "Link not found" };

  await prisma.taskLink.delete({ where: { id: linkId } });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: link.taskId,
    before: { linkId: link.id, label: link.label },
    changeNote: `Link "${link.label}" removed from task`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function addTaskFile(
  taskId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) return { error: "Task not found" };

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
  const safeName = sanitizeTaskFilename(originalName);
  const id = crypto.randomUUID?.() ?? `tf-${Date.now()}`;
  const storedFilename = `${taskId}-${id}-${safeName}`;
  const tasksUploadDir = getTasksUploadDir(projectId);
  const filePath = path.join(tasksUploadDir, storedFilename);

  await mkdir(tasksUploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const taskFile = await prisma.taskFile.create({
    data: {
      taskId,
      filePath: storedFilename,
      fileName: originalName
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: taskId,
    after: { fileId: taskFile.id, fileName: originalName },
    changeNote: `File "${originalName}" attached to task`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function removeTaskFile(fileId: string): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const taskFile = await prisma.taskFile.findUnique({
    where: { id: fileId },
    include: { task: true }
  });
  if (!taskFile || taskFile.task.projectId !== projectId) return { error: "File not found" };

  const fullPath = path.join(getTasksUploadDir(projectId), taskFile.filePath);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing file
  }

  await prisma.taskFile.delete({ where: { id: fileId } });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: taskFile.taskId,
    before: { fileId: taskFile.id, fileName: taskFile.fileName },
    changeNote: `File "${taskFile.fileName}" removed from task`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function reorderTask(
  id: string,
  newStatus: string,
  newPosition: number
): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();
  const parsed = updateTaskStatusSchema.safeParse({ id, status: newStatus });
  if (!parsed.success) return { error: "Invalid status" };

  const before = await prisma.task.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Task not found" };

  // Validate position is a finite safe number
  const validPosition = z.number().finite().safe().safeParse(newPosition);
  if (!validPosition.success) return { error: "Invalid position" };

  const afterRecord = await prisma.task.update({
    where: { id, projectId },
    data: { status: newStatus, position: validPosition.data }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: `Moved to ${newStatus}`,
    performedBy: await getPerformedBy()
  });

  await syncEntityFromTask(id, newStatus);

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function updateTaskPriority(
  id: string,
  priority: string
): Promise<ActionResult> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();

  const validPriority = z.enum(TASK_PRIORITIES).safeParse(priority);
  if (!validPriority.success) return { error: "Invalid priority" };

  const before = await prisma.task.findFirst({ where: { id, projectId } });
  if (!before) return { error: "Task not found" };

  const afterRecord = await prisma.task.update({
    where: { id, projectId },
    data: { priority: validPriority.data }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Task",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: `Priority set to ${validPriority.data}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  revalidatePath("/");
  return {};
}

export async function quickCreateTask(
  title: string,
  status: string,
  position: number
): Promise<ActionResult & { id?: string }> {
  await requireSectionAccess("tasks");
  const projectId = await requireCurrentProjectId();

  const trimmed = title.trim();
  if (!trimmed) return { error: "Title is required" };
  if (trimmed.length > 500) return { error: "Title too long" };
  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
    return { error: "Invalid status" };
  }
  const validPosition = z.number().finite().safe().safeParse(position);
  if (!validPosition.success) return { error: "Invalid position" };

  const task = await prisma.task.create({
    data: {
      projectId,
      title: trimmed,
      status,
      position: validPosition.data
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Task",
    entityId: task.id,
    after: task,
    changeNote: `Quick-created "${task.title}"`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/tasks");
  return { id: task.id };
}
