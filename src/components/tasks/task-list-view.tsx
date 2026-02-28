"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskStatusPill } from "./task-status-pill";
import { TaskPriorityIcon } from "./task-priority-icon";
import { TaskDetailPanel } from "./task-detail-panel";
import type { KanbanTask } from "./task-kanban-card";

type SortKey = "title" | "status" | "priority" | "owner" | "dueDate" | "updatedAt";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = { Todo: 0, Doing: 1, Done: 2 };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

type TaskListViewProps = {
  tasks: KanbanTask[];
  ownerOptions: Array<{ value: string; label: string }>;
  ownerDisplayNames: Record<string, string>;
};

export function TaskListView({ tasks, ownerOptions, ownerDisplayNames }: TaskListViewProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("status");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [detailTask, setDetailTask] = React.useState<KanbanTask | null>(null);
  const router = useRouter();

  // Update detail panel when tasks change
  React.useEffect(() => {
    if (detailTask) {
      const updated = tasks.find((t) => t.id === detailTask.id);
      if (updated) setDetailTask(updated);
      else setDetailTask(null);
    }
  }, [tasks, detailTask?.id]);

  const sorted = React.useMemo(() => {
    const arr = [...tasks];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
          break;
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
          break;
        case "owner":
          cmp = (a.owner ?? "zzz").localeCompare(b.owner ?? "zzz");
          break;
        case "dueDate": {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = da - db;
          break;
        }
        case "updatedAt":
          cmp = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [tasks, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    return (
      <button
        type="button"
        onClick={() => toggleSort(col)}
        className={cn(
          "flex items-center gap-1 text-xs font-medium uppercase tracking-wider hover:text-foreground transition-colors",
          sortKey === col ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    );
  }

  function isOverdue(dueDate: Date | null, status: string): boolean {
    if (!dueDate || status === "Done") return false;
    return new Date(dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5"><SortHeader label="Title" col="title" /></th>
              <th className="text-left px-3 py-2.5 w-28"><SortHeader label="Status" col="status" /></th>
              <th className="text-left px-3 py-2.5 w-24"><SortHeader label="Priority" col="priority" /></th>
              <th className="text-left px-3 py-2.5 w-32"><SortHeader label="Assignee" col="owner" /></th>
              <th className="text-left px-3 py-2.5 w-28"><SortHeader label="Due" col="dueDate" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No tasks match your filters</td>
              </tr>
            )}
            {sorted.map((task) => {
              const overdue = isOverdue(task.dueDate, task.status);
              return (
                <tr
                  key={task.id}
                  onClick={() => setDetailTask(task)}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <TaskPriorityIcon priority={task.priority} />
                      <span className={cn("font-medium", task.status === "Done" && "line-through opacity-60")}>
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5"><TaskStatusPill status={task.status} /></td>
                  <td className="px-3 py-2.5">
                    <TaskPriorityIcon priority={task.priority} showLabel />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {task.owner ? (ownerDisplayNames[task.owner] ?? task.owner) : "—"}
                  </td>
                  <td className={cn("px-3 py-2.5", overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground")}>
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {sorted.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No tasks match your filters</p>
        )}
        {sorted.map((task) => {
          const overdue = isOverdue(task.dueDate, task.status);
          const ownerName = task.owner ? (ownerDisplayNames[task.owner] ?? task.owner) : null;
          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailTask(task)}
              onKeyDown={(e) => { if (e.key === "Enter") setDetailTask(task); }}
              className="rounded-lg border border-border bg-card p-3 space-y-1.5 cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-2">
                <TaskPriorityIcon priority={task.priority} className="mt-0.5" />
                <span className={cn("font-medium flex-1", task.status === "Done" && "line-through opacity-60")}>
                  {task.title}
                </span>
                <TaskStatusPill status={task.status} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {ownerName && <span>{ownerName}</span>}
                {ownerName && task.dueDate && <span>·</span>}
                {task.dueDate && (
                  <span className={cn(overdue && "text-red-600 dark:text-red-400 font-medium")}>
                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDetailPanel
        task={detailTask}
        ownerOptions={ownerOptions}
        open={detailTask !== null}
        onOpenChange={(open) => !open && setDetailTask(null)}
      />
    </>
  );
}
