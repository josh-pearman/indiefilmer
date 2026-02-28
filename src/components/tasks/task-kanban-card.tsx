"use client";

import * as React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Paperclip, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskPriorityIcon, getPriorityBorderClass } from "./task-priority-icon";
import { TaskStatusPill } from "./task-status-pill";

const CATEGORY_LABELS: Record<string, string> = {
  camera: "Camera",
  sound: "Sound",
  art: "Art",
  locations: "Locations",
  permits: "Permits",
  post: "Post",
  general: "General"
};

export type KanbanTask = {
  id: string;
  title: string;
  owner: string | null;
  status: string;
  priority: string;
  category: string | null;
  position: number;
  dueDate: Date | null;
  notes: string | null;
  sourceNoteId: string | null;
  createdAt: Date;
  updatedAt: Date;
  files?: { id: string; fileName: string; filePath: string }[];
  links?: { id: string; label: string; url: string }[];
};

type TaskKanbanCardProps = {
  task: KanbanTask;
  index: number;
  ownerDisplayNames: Record<string, string>;
  onClick: (task: KanbanTask) => void;
};

function isOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate || status === "Done") return false;
  return new Date(dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
}

function isDueToday(dueDate: Date | null, status: string): boolean {
  if (!dueDate || status === "Done") return false;
  const d = new Date(dueDate);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

export function TaskKanbanCard({ task, index, ownerDisplayNames, onClick }: TaskKanbanCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  const dueToday = isDueToday(task.dueDate, task.status);
  const fileCount = task.files?.length ?? 0;
  const linkCount = task.links?.length ?? 0;
  const ownerName = task.owner ? (ownerDisplayNames[task.owner] ?? task.owner) : null;
  const categoryLabel = task.category ? CATEGORY_LABELS[task.category] ?? task.category : null;
  const isDone = task.status === "Done";
  const isTodo = task.status === "Todo";

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          role="button"
          tabIndex={0}
          onClick={() => onClick(task)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick(task);
            }
          }}
          className={cn(
            "rounded-lg border bg-card text-sm transition-all cursor-pointer border-l-[3px]",
            getPriorityBorderClass(task.priority),
            snapshot.isDragging
              ? "shadow-lg ring-2 ring-ring/20 scale-[1.02]"
              : "hover:shadow-md hover:border-border/80",
            isTodo && "border-dashed bg-muted"
          )}
          style={{
            ...provided.draggableProps.style
          }}
        >
          <div className="p-3 space-y-2">
            {/* Row 1: Priority + Title */}
            <div className="flex items-start gap-2">
              {task.priority !== "none" && (
                <TaskPriorityIcon priority={task.priority} className={cn("mt-0.5", (isTodo || isDone) && "opacity-40")} />
              )}
              <span className={cn(
                "font-medium flex-1 min-w-0 line-clamp-2 text-foreground",
                isDone && "line-through"
              )}>
                {task.title}
              </span>
            </div>

            {/* Row 2: Metadata chips */}
            {(ownerName || task.dueDate || categoryLabel) && (
              <div className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
                (isTodo || isDone) && "opacity-50"
              )}>
                {ownerName && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium uppercase">
                      {ownerName.charAt(0)}
                    </span>
                    {ownerName}
                  </span>
                )}
                {task.dueDate && (
                  <span className={cn(
                    overdue && !isTodo && "text-red-600 dark:text-red-400 font-medium",
                    dueToday && !overdue && !isTodo && "text-amber-600 dark:text-amber-400 font-medium"
                  )}>
                    {overdue ? "Overdue · " : dueToday ? "Today · " : ""}
                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                )}
                {categoryLabel && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{categoryLabel}</span>
                )}
              </div>
            )}

            {/* Row 3: Attachments */}
            {(fileCount > 0 || linkCount > 0) && (
              <div className={cn(
                "flex items-center gap-2 text-xs text-muted-foreground",
                (isTodo || isDone) && "opacity-50"
              )}>
                {fileCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Paperclip className="h-3 w-3" />{fileCount}
                  </span>
                )}
                {linkCount > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <LinkIcon className="h-3 w-3" />{linkCount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
