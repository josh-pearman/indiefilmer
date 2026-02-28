"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateTask, deleteTask, addTaskLink, removeTaskLink, addTaskFile, removeTaskFile } from "@/actions/tasks";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinksSection } from "@/components/shared/links-section";
import { FilesSection } from "@/components/shared/files-section";
import { TaskStatusPill, STATUS_CONFIG } from "./task-status-pill";
import { TaskPriorityIcon, PRIORITY_CONFIG } from "./task-priority-icon";
import type { KanbanTask } from "./task-kanban-card";

const CATEGORY_OPTIONS = [
  { value: "", label: "None" },
  { value: "camera", label: "Camera" },
  { value: "sound", label: "Sound" },
  { value: "art", label: "Art" },
  { value: "locations", label: "Locations" },
  { value: "permits", label: "Permits" },
  { value: "post", label: "Post" },
  { value: "general", label: "General" }
];

type TaskDetailPanelProps = {
  task: KanbanTask | null;
  ownerOptions: Array<{ value: string; label: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TaskDetailPanel({ task, ownerOptions, open, onOpenChange }: TaskDetailPanelProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const linkItems = React.useMemo(
    () => (task?.links ?? []).map((l) => ({ id: l.id, label: l.label, url: l.url })),
    [task?.links]
  );
  const fileItems = React.useMemo(
    () => (task?.files ?? []).map((f) => ({ id: f.id, fileName: f.fileName, filePath: f.filePath })),
    [task?.files]
  );

  async function handleSubmit(formData: FormData) {
    if (!task) return;
    setError(null);
    setPending(true);
    const result = await updateTask(task.id, formData);
    if (result.error) setError(result.error);
    else {
      router.refresh();
      onOpenChange(false);
    }
    setPending(false);
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm("Delete this task? You can restore it later.")) return;
    setDeleting(true);
    await deleteTask(task.id);
    setDeleting(false);
    onOpenChange(false);
    router.refresh();
  }

  async function handleAddLink(label: string, url: string) {
    if (!task) return;
    await addTaskLink(task.id, label, url);
    router.refresh();
  }
  async function handleRemoveLink(id: string) {
    await removeTaskLink(id);
    router.refresh();
  }
  async function handleAttachFile(formData: FormData) {
    if (!task) return;
    await addTaskFile(task.id, formData);
    router.refresh();
  }
  async function handleRemoveFile(id: string) {
    await removeTaskFile(id);
    router.refresh();
  }

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-5">
          {/* Header with status + priority quick selectors */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <TaskStatusPill status={task.status} size="md" />
              <TaskPriorityIcon priority={task.priority} showLabel />
              {task.category && (
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{
                  CATEGORY_OPTIONS.find((c) => c.value === task.category)?.label ?? task.category
                }</span>
              )}
            </div>
          </div>

          {/* Edit form */}
          <form action={handleSubmit} className="space-y-4" aria-busy={pending}>
            <div className="space-y-2">
              <Label htmlFor="detail-title">Title</Label>
              <Input
                id="detail-title"
                name="title"
                required
                defaultValue={task.title}
                key={task.id + "-title"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="detail-status">Status</Label>
                <select
                  id="detail-status"
                  name="status"
                  defaultValue={task.status}
                  key={task.id + "-status"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {Object.keys(STATUS_CONFIG).map((s) => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-priority">Priority</Label>
                <select
                  id="detail-priority"
                  name="priority"
                  defaultValue={task.priority}
                  key={task.id + "-priority"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="detail-owner">Assignee</Label>
                <select
                  id="detail-owner"
                  name="owner"
                  defaultValue={task.owner ?? ""}
                  key={task.id + "-owner"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {ownerOptions.map((o) => (
                    <option key={o.value || "_unassigned"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="detail-category">Category</Label>
                <select
                  id="detail-category"
                  name="category"
                  defaultValue={task.category ?? ""}
                  key={task.id + "-category"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value || "_none"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="detail-dueDate">Due Date</Label>
              <Input
                id="detail-dueDate"
                name="dueDate"
                type="date"
                defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                key={task.id + "-dueDate"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="detail-notes">Notes</Label>
              <textarea
                id="detail-notes"
                name="notes"
                rows={4}
                defaultValue={task.notes ?? ""}
                key={task.id + "-notes"}
                placeholder="Add notes..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </form>

          {/* Links & files */}
          <div className="border-t border-border pt-4 space-y-4">
            <LinksSection items={linkItems} onAdd={handleAddLink} onRemove={handleRemoveLink} />
            <FilesSection
              items={fileItems}
              onAttach={handleAttachFile}
              onRemove={handleRemoveFile}
              fileServeBasePath="/api/task-files"
              title="Attachments"
              attachButtonLabel="Add Attachment"
            />
          </div>

          {/* Source note */}
          {task.sourceNoteId && (
            <p className="text-xs text-muted-foreground border-t border-border pt-2">
              Created from note:{" "}
              <Link href={`/production/notes/${task.sourceNoteId}`} className="underline hover:no-underline">
                View note
              </Link>
            </p>
          )}

          {/* Footer */}
          <div className="border-t border-border pt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Created {new Date(task.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              <br />
              Updated {new Date(task.updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
