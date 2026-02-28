"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createTask, updateTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const STATUS_OPTIONS = [
  { value: "Todo", label: "To Do" },
  { value: "Doing", label: "Doing" },
  { value: "Done", label: "Done" }
] as const;

export type TaskFormValues = {
  title: string;
  owner: string;
  status: string;
  dueDate: string;
  notes: string;
};

type TaskFormProps = {
  mode: "create" | "edit";
  taskId?: string;
  defaultValues: TaskFormValues;
  ownerOptions: Array<{ value: string; label: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function TaskForm({
  mode,
  taskId,
  defaultValues,
  ownerOptions,
  onSuccess,
  onCancel,
  submitLabel
}: TaskFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      if (mode === "create") {
        const result = await createTask(formData);
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      } else if (taskId) {
        const result = await updateTask(taskId, formData);
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" aria-busy={pending}>
      <div className="space-y-2">
        <Label htmlFor="task-title">Title (required)</Label>
        <Input
          id="task-title"
          name="title"
          required
          defaultValue={defaultValues.title}
          placeholder="Task title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-owner">Owner</Label>
        <select
          id="task-owner"
          name="owner"
          defaultValue={defaultValues.owner}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          {ownerOptions.map((o) => (
            <option key={o.value || "_unassigned"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-status">Status</Label>
        <select
          id="task-status"
          name="status"
          defaultValue={defaultValues.status}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-dueDate">Due date</Label>
        <Input
          id="task-dueDate"
          name="dueDate"
          type="date"
          defaultValue={defaultValues.dueDate || undefined}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Leave empty for no due date</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="task-notes">Notes</Label>
        <textarea
          id="task-notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes}
          placeholder="Optional notes"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? (mode === "create" ? "Creating..." : "Saving...")
            : (submitLabel ?? (mode === "create" ? "Create" : "Save"))}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export const defaultTaskFormValues: TaskFormValues = {
  title: "",
  owner: "",
  status: "Todo",
  dueDate: "",
  notes: ""
};
