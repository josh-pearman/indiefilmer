import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { getNoteCategories } from "@/actions/notes";
import { NoteList } from "@/components/notes/note-list";

async function getNotes() {
  const projectId = await requireCurrentProjectId();
  const notes = await prisma.note.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: {
      files: { select: { id: true, fileName: true, filePath: true } },
      links: { select: { id: true, label: true, url: true } }
    }
  });
  return notes.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    createdAt: n.createdAt,
    isDeleted: n.isDeleted,
    files: n.files,
    links: n.links
  }));
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

export default async function NotesPage() {
  const [notes, categories, ownerOptions] = await Promise.all([
    getNotes(),
    getNoteCategories(),
    getOwnerOptions()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture ideas, references, and production info. Attach files, embed links, and convert notes into tasks.
        </p>
      </div>
      <NoteList notes={notes} categories={categories} ownerOptions={ownerOptions} />
    </div>
  );
}
