import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";

const STATUS_MAP: Record<
  string,
  { doneStatus: string; revertStatus: string }
> = {
  CastMember: { doneStatus: "Confirmed", revertStatus: "Pending" },
  CrewMember: { doneStatus: "Confirmed", revertStatus: "Pending" },
  Location: { doneStatus: "Booked", revertStatus: "On Hold" },
};

/**
 * When an entity's status changes, sync the linked task accordingly.
 * entityDoneStatus is the status value that means "done" for this entity type.
 */
export async function syncTaskFromEntity(
  entityType: string,
  entityId: string,
  currentEntityStatus: string
): Promise<void> {
  const mapping = STATUS_MAP[entityType];
  if (!mapping) return;

  const task = await prisma.task.findFirst({
    where: {
      sourceEntityType: entityType,
      sourceEntityId: entityId,
      isDeleted: false,
    },
  });
  if (!task) return;

  const isDone = currentEntityStatus === mapping.doneStatus;
  const newTaskStatus = isDone ? "Done" : "Todo";

  if (task.status === newTaskStatus) return;

  const before = { ...task };
  const afterRecord = await prisma.task.update({
    where: { id: task.id },
    data: { status: newTaskStatus },
  });

  const performedBy = await getPerformedBy();
  await logAudit({
    action: "update",
    entityType: "Task",
    entityId: task.id,
    before,
    after: afterRecord,
    changeNote: `Auto-synced to ${newTaskStatus} (${entityType} ${currentEntityStatus})`,
    performedBy,
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

/**
 * When a task's status changes, sync the linked entity accordingly.
 */
export async function syncEntityFromTask(
  taskId: string,
  newTaskStatus: string
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { sourceEntityType: true, sourceEntityId: true },
  });
  if (!task?.sourceEntityType || !task?.sourceEntityId) return;

  const mapping = STATUS_MAP[task.sourceEntityType];
  if (!mapping) return;

  const isDone = newTaskStatus === "Done";
  const newEntityStatus = isDone ? mapping.doneStatus : mapping.revertStatus;

  const performedBy = await getPerformedBy();

  if (task.sourceEntityType === "CastMember") {
    const entity = await prisma.castMember.findUnique({
      where: { id: task.sourceEntityId },
    });
    if (!entity || entity.status === newEntityStatus) return;

    const afterRecord = await prisma.castMember.update({
      where: { id: task.sourceEntityId },
      data: { status: newEntityStatus },
    });
    await logAudit({
      action: "update",
      entityType: "CastMember",
      entityId: task.sourceEntityId,
      before: entity,
      after: afterRecord,
      changeNote: `Auto-synced to ${newEntityStatus} (task moved to ${newTaskStatus})`,
      performedBy,
    });
    revalidatePath("/cast");
    revalidatePath(`/cast/${task.sourceEntityId}`);
  } else if (task.sourceEntityType === "CrewMember") {
    const entity = await prisma.crewMember.findUnique({
      where: { id: task.sourceEntityId },
    });
    if (!entity || entity.status === newEntityStatus) return;

    const afterRecord = await prisma.crewMember.update({
      where: { id: task.sourceEntityId },
      data: { status: newEntityStatus },
    });
    await logAudit({
      action: "update",
      entityType: "CrewMember",
      entityId: task.sourceEntityId,
      before: entity,
      after: afterRecord,
      changeNote: `Auto-synced to ${newEntityStatus} (task moved to ${newTaskStatus})`,
      performedBy,
    });
    revalidatePath("/crew");
    revalidatePath(`/crew/${task.sourceEntityId}`);
  } else if (task.sourceEntityType === "Location") {
    const entity = await prisma.location.findUnique({
      where: { id: task.sourceEntityId },
    });
    if (!entity || entity.status === newEntityStatus) return;

    const afterRecord = await prisma.location.update({
      where: { id: task.sourceEntityId },
      data: { status: newEntityStatus },
    });
    await logAudit({
      action: "update",
      entityType: "Location",
      entityId: task.sourceEntityId,
      before: entity,
      after: afterRecord,
      changeNote: `Auto-synced to ${newEntityStatus} (task moved to ${newTaskStatus})`,
      performedBy,
    });
    revalidatePath("/production/locations");
    revalidatePath(`/locations/${task.sourceEntityId}`);
  }
}
