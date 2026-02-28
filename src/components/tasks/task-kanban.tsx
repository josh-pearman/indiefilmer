"use client";

import * as React from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { reorderTask, quickCreateTask } from "@/actions/tasks";
import { TaskKanbanColumn } from "./task-kanban-column";
import { TaskDetailPanel } from "./task-detail-panel";
import type { KanbanTask } from "./task-kanban-card";

const STATUSES = ["Todo", "Doing", "Done"] as const;

type TaskKanbanProps = {
  tasks: KanbanTask[];
  ownerOptions: Array<{ value: string; label: string }>;
  ownerDisplayNames: Record<string, string>;
};

export function TaskKanban({ tasks: serverTasks, ownerOptions, ownerDisplayNames }: TaskKanbanProps) {
  const router = useRouter();
  const [tasks, setTasks] = React.useState(serverTasks);
  const [detailTask, setDetailTask] = React.useState<KanbanTask | null>(null);
  const [mounted, setMounted] = React.useState(false);

  // Fix @hello-pangea/dnd hydration: only render Droppables after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync with server data when it changes
  React.useEffect(() => {
    setTasks(serverTasks);
    if (detailTask) {
      const updated = serverTasks.find((t) => t.id === detailTask.id);
      if (updated) setDetailTask(updated);
      else setDetailTask(null);
    }
  }, [serverTasks, detailTask?.id]);

  const tasksByStatus = React.useMemo(() => {
    const map: Record<string, KanbanTask[]> = {};
    for (const s of STATUSES) map[s] = [];
    for (const t of tasks) {
      // Put any unknown statuses into Todo
      const bucket = map[t.status] ?? map.Todo;
      bucket.push(t);
    }
    for (const s of STATUSES) {
      map[s].sort((a, b) => a.position - b.position);
    }
    return map;
  }, [tasks]);

  async function handleDragEnd(result: DropResult) {
    const { draggableId, source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;

    const newStatus = destination.droppableId;
    const destTasks = tasksByStatus[newStatus]?.filter((t) => t.id !== draggableId) ?? [];

    let newPosition: number;
    if (destTasks.length === 0) {
      newPosition = 1000;
    } else if (destination.index === 0) {
      newPosition = destTasks[0].position / 2;
    } else if (destination.index >= destTasks.length) {
      newPosition = destTasks[destTasks.length - 1].position + 1000;
    } else {
      const before = destTasks[destination.index - 1].position;
      const after = destTasks[destination.index].position;
      newPosition = (before + after) / 2;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggableId ? { ...t, status: newStatus, position: newPosition } : t
      )
    );

    const res = await reorderTask(draggableId, newStatus, newPosition);
    if (res.error) {
      setTasks(serverTasks);
    } else {
      router.refresh();
    }
  }

  async function handleQuickAdd(title: string, status: string) {
    const lastTask = tasksByStatus[status]?.at(-1);
    const position = (lastTask?.position ?? 0) + 1000;

    const result = await quickCreateTask(title, status, position);
    if (!result.error) {
      router.refresh();
    }
  }

  if (!mounted) {
    // SSR / pre-hydration: render static columns without drag-and-drop
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATUSES.map((status) => {
          const colTasks = tasksByStatus[status];
          const label = status === "Todo" ? "To Do" : status;
          return (
            <div key={status} className="rounded-xl border border-border bg-muted/10 min-h-[120px] p-4">
              <h3 className="font-semibold text-sm mb-3">{label}</h3>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border bg-card p-3 text-sm">
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map((status) => (
            <TaskKanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              ownerDisplayNames={ownerDisplayNames}
              onOpenDetail={setDetailTask}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      </DragDropContext>

      <TaskDetailPanel
        task={detailTask}
        ownerOptions={ownerOptions}
        open={detailTask !== null}
        onOpenChange={(open) => !open && setDetailTask(null)}
      />
    </>
  );
}
