"use client";

import * as React from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskKanban } from "./task-kanban";
import { TaskListView } from "./task-list-view";
import { TaskFilterBar, type TaskFilters, emptyFilters, hasActiveFilters } from "./task-filter-bar";
import type { KanbanTask } from "./task-kanban-card";

type ViewMode = "board" | "list";

type TaskBoardShellProps = {
  tasks: KanbanTask[];
  ownerOptions: Array<{ value: string; label: string }>;
  ownerDisplayNames: Record<string, string>;
};

function isOverdue(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);
}

function isDueToday(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function isDueThisWeek(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (7 - today.getDay()));
  return d >= today && d <= weekEnd;
}

function applyFilters(tasks: KanbanTask[], filters: TaskFilters): KanbanTask[] {
  let filtered = tasks;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      (t.notes?.toLowerCase().includes(q) ?? false)
    );
  }

  if (filters.owners.length > 0) {
    filtered = filtered.filter((t) =>
      filters.owners.includes(t.owner ?? "")
    );
  }

  if (filters.priorities.length > 0) {
    filtered = filtered.filter((t) =>
      filters.priorities.includes(t.priority)
    );
  }

  if (filters.dueDateFilter) {
    switch (filters.dueDateFilter) {
      case "overdue":
        filtered = filtered.filter((t) => isOverdue(t.dueDate) && t.status !== "Done");
        break;
      case "today":
        filtered = filtered.filter((t) => isDueToday(t.dueDate));
        break;
      case "week":
        filtered = filtered.filter((t) => isDueThisWeek(t.dueDate));
        break;
      case "none":
        filtered = filtered.filter((t) => !t.dueDate);
        break;
    }
  }

  if (filters.categories.length > 0) {
    filtered = filtered.filter((t) =>
      t.category !== null && filters.categories.includes(t.category)
    );
  }

  return filtered;
}

export function TaskBoardShell({ tasks, ownerOptions, ownerDisplayNames }: TaskBoardShellProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("board");
  const [filters, setFilters] = React.useState<TaskFilters>(emptyFilters);

  const filteredTasks = React.useMemo(
    () => hasActiveFilters(filters) ? applyFilters(tasks, filters) : tasks,
    [tasks, filters]
  );

  return (
    <div className="space-y-4">
      {/* Toolbar: filters + view toggle */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <TaskFilterBar
            filters={filters}
            onChange={setFilters}
            ownerOptions={ownerOptions}
          />
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-border p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "board" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Board view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Active view */}
      {viewMode === "board" ? (
        <TaskKanban
          tasks={filteredTasks}
          ownerOptions={ownerOptions}
          ownerDisplayNames={ownerDisplayNames}
        />
      ) : (
        <TaskListView
          tasks={filteredTasks}
          ownerOptions={ownerOptions}
          ownerDisplayNames={ownerDisplayNames}
        />
      )}
    </div>
  );
}
