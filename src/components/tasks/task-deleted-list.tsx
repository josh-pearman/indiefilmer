"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { restoreTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  Todo: "To Do",
  Doing: "Doing",
  Done: "Done"
};

type DeletedTask = {
  id: string;
  title: string;
  owner: string | null;
  status: string;
  dueDate: Date | null;
  notes: string | null;
  updatedAt: Date;
};

type TaskDeletedListProps = {
  tasks: DeletedTask[];
  ownerDisplayNames: Record<string, string>;
};

function getOwnerDisplay(owner: string | null, ownerDisplayNames: Record<string, string>): string {
  if (!owner) return "Unassigned";
  return ownerDisplayNames[owner] ?? owner;
}

export function TaskDeletedList({ tasks, ownerDisplayNames }: TaskDeletedListProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  async function handleRestore(id: string) {
    setRestoringId(id);
    await restoreTask(id);
    setRestoringId(null);
    router.refresh();
  }

  if (tasks.length === 0) return null;

  return (
    <div className="border-t border-border pt-4 mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {open ? "Hide" : "View"} deleted tasks ({tasks.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              )}
            >
              <span className="line-through text-muted-foreground">{task.title}</span>
              <span className="text-xs text-muted-foreground">
                {getOwnerDisplay(task.owner, ownerDisplayNames)} · {STATUS_LABELS[task.status] ?? task.status}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRestore(task.id)}
                disabled={restoringId === task.id}
              >
                {restoringId === task.id ? "Restoring…" : "Restore"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
