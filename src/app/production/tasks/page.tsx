import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { TaskBoardShell } from "@/components/tasks/task-board-shell";
import { TaskDeletedList } from "@/components/tasks/task-deleted-list";

async function getActiveTasks() {
  const projectId = await requireCurrentProjectId();
  return prisma.task.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { position: "asc" },
    include: {
      files: { select: { id: true, fileName: true, filePath: true } },
      links: { select: { id: true, label: true, url: true } }
    }
  });
}

async function getDeletedTasks() {
  const projectId = await requireCurrentProjectId();
  return prisma.task.findMany({
    where: { projectId, isDeleted: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      owner: true,
      status: true,
      dueDate: true,
      notes: true,
      updatedAt: true
    }
  });
}

async function getOwnerOptions() {
  const projectId = await requireCurrentProjectId();

  // Get project members for the dropdown (task.owner stores username, not user ID)
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, username: true } } }
  });
  const memberUsernames = new Set(members.map((m) => m.user.username).filter(Boolean));

  // Also include any owners already assigned to tasks (they may not be project members)
  const tasksWithOwners = await prisma.task.findMany({
    where: { projectId, isDeleted: false, owner: { not: null } },
    select: { owner: true },
    distinct: ["owner"]
  });
  const extraOwnerNames = tasksWithOwners
    .map((t) => t.owner!)
    .filter((name) => !memberUsernames.has(name));

  const extraUsers = extraOwnerNames.length > 0
    ? await prisma.user.findMany({
        where: { username: { in: extraOwnerNames } },
        select: { name: true, username: true }
      })
    : [];

  const allOptions = [
    ...members.map((m) => ({ name: m.user.name, username: m.user.username })),
    ...extraUsers
  ];
  // Deduplicate by username
  const seen = new Set<string>();
  const unique = allOptions.filter((u) => {
    const key = u.username ?? u.name ?? "";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const sorted = [...unique].sort((a, b) => {
    const na = a.name ?? a.username ?? "";
    const nb = b.name ?? b.username ?? "";
    return na.localeCompare(nb);
  });

  return [
    { value: "", label: "Unassigned" },
    ...sorted.map((u) => ({ value: u.username ?? u.name ?? "", label: u.name ?? u.username ?? "" }))
  ];
}

export default async function TasksPage() {
  const [activeTasks, deletedTasks, ownerOptions] = await Promise.all([
    getActiveTasks(),
    getDeletedTasks(),
    getOwnerOptions()
  ]);

  const ownerDisplayNames: Record<string, string> = {};
  ownerOptions.forEach((o) => {
    if (o.value) ownerDisplayNames[o.value] = o.label;
  });
  ownerDisplayNames[""] = "Unassigned";

  const tasksForBoard = activeTasks.map((t) => ({
    id: t.id,
    title: t.title,
    owner: t.owner,
    status: t.status,
    priority: t.priority,
    category: t.category,
    position: t.position,
    dueDate: t.dueDate,
    notes: t.notes,
    sourceNoteId: t.sourceNoteId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    files: t.files,
    links: t.links
  }));

  const deletedForList = deletedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    owner: t.owner,
    status: t.status,
    dueDate: t.dueDate,
    notes: t.notes,
    updatedAt: t.updatedAt
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag tasks between columns, filter by assignee or priority, and switch between board and list views.
        </p>
      </div>

      <TaskBoardShell
        tasks={tasksForBoard}
        ownerOptions={ownerOptions}
        ownerDisplayNames={ownerDisplayNames}
      />

      <TaskDeletedList
        tasks={deletedForList}
        ownerDisplayNames={ownerDisplayNames}
      />
    </div>
  );
}
