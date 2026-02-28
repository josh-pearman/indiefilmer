"use client";

import * as React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { TaskKanbanCard, type KanbanTask } from "./task-kanban-card";
import { TaskQuickAdd } from "./task-quick-add";
import { STATUS_CONFIG } from "./task-status-pill";

type TaskKanbanColumnProps = {
  status: string;
  tasks: KanbanTask[];
  ownerDisplayNames: Record<string, string>;
  onOpenDetail: (task: KanbanTask) => void;
  onQuickAdd: (title: string, status: string) => void;
};

export function TaskKanbanColumn({
  status,
  tasks,
  ownerDisplayNames,
  onOpenDetail,
  onQuickAdd
}: TaskKanbanColumnProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.Doing;
  const isDone = status === "Done";

  return (
    <div className="flex flex-col rounded-xl border border-border bg-muted/10">
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className={cn(
          "h-2.5 w-2.5 rounded-full shrink-0",
          status === "Todo" && "bg-zinc-400",
          status === "Doing" && "bg-amber-500",
          status === "Done" && "bg-emerald-500"
        )} />
        <h3 className="font-semibold text-sm flex-1">{config.label}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-2 space-y-2 overflow-y-auto transition-colors min-h-[80px]",
              snapshot.isDraggingOver && "bg-muted/30 rounded-b-xl"
            )}
          >
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-xs text-muted-foreground py-8 text-center">
                {isDone ? "No completed tasks" : "Drop tasks here"}
              </p>
            )}
            {tasks.map((task, index) => (
              <TaskKanbanCard
                key={task.id}
                task={task}
                index={index}
                ownerDisplayNames={ownerDisplayNames}
                onClick={onOpenDetail}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {/* Quick add */}
      <div className="border-t border-border p-1">
        <TaskQuickAdd status={status} onAdd={onQuickAdd} />
      </div>
    </div>
  );
}
