import { prisma } from "./db";

type AuditAction = "create" | "update" | "delete" | "restore";

interface LogAuditParams {
  projectId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  changeNote?: string;
  performedBy?: string;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  const {
    projectId,
    action,
    entityType,
    entityId,
    before,
    after,
    changeNote,
    performedBy
  } = params;

  await prisma.auditLog.create({
    data: {
      ...(projectId && { projectId }),
      action,
      entityType,
      entityId,
      before: before !== undefined ? JSON.stringify(before) : null,
      after: after !== undefined ? JSON.stringify(after) : null,
      changeNote: changeNote ?? null,
      performedBy: performedBy ?? "Editor"
    }
  });
}

