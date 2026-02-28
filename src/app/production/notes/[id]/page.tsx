import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { getNoteCategories } from "@/actions/notes";
import { NoteDetail } from "@/components/notes/note-detail";

async function getNote(id: string, projectId: string) {
  return prisma.note.findFirst({
    where: { id, projectId },
    include: {
      files: { select: { id: true, fileName: true, filePath: true } },
      links: { select: { id: true, label: true, url: true } }
    }
  });
}

async function getNoteAuditLog(noteId: string, limit: number, projectId: string) {
  return prisma.auditLog.findMany({
    where: { projectId, entityType: "Note", entityId: noteId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

async function getOwnerOptions() {
  const users = await prisma.user.findMany({
    where: { approved: true },
    select: { id: true, name: true, username: true }
  });
  const sorted = [...users].sort((a, b) => {
    const na = a.name ?? a.username ?? "";
    const nb = b.name ?? b.username ?? "";
    return na.localeCompare(nb);
  });
  return [
    { value: "", label: "Unassigned" },
    ...sorted.map((u) => ({ value: u.id, label: u.name ?? u.username ?? u.id }))
  ];
}

export default async function NoteDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await requireCurrentProjectId();
  const [note, auditEntries, categories, ownerOptions] = await Promise.all([
    getNote(id, projectId),
    getNoteAuditLog(id, 50, projectId),
    getNoteCategories(),
    getOwnerOptions()
  ]);

  if (!note) notFound();

  const auditForProps = auditEntries.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    before: e.before,
    after: e.after,
    changeNote: e.changeNote,
    performedBy: e.performedBy,
    createdAt: e.createdAt
  }));

  return (
    <NoteDetail
      note={{
        id: note.id,
        title: note.title,
        category: note.category,
        body: note.body,
        isDeleted: note.isDeleted,
        files: note.files,
        links: note.links
      }}
      auditEntries={auditForProps}
      categories={categories}
      ownerOptions={ownerOptions}
    />
  );
}
