"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { convertNoteToTask } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { ListTodo } from "lucide-react";

type OwnerOption = { value: string; label: string };

type ConvertToTaskModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  noteTitle: string;
  ownerOptions: OwnerOption[];
};

export function ConvertToTaskModal({
  open,
  onOpenChange,
  noteId,
  noteTitle,
  ownerOptions
}: ConvertToTaskModalProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [taskId, setTaskId] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("noteId", noteId);
    const result = await convertNoteToTask(noteId, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
    } else if (result.taskId) {
      setTaskId(result.taskId);
      router.refresh();
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setTaskId(null);
      setError(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="">
          <div className="mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              Convert to Task
            </h2>
          </div>
        <div className="mt-6 space-y-4">
          {taskId ? (
            <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium">Task created.</p>
              <Link
                href="/production/tasks"
                onClick={() => handleClose(false)}
                className="mt-1 inline-block text-sm text-primary underline hover:no-underline"
              >
                View task →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This will create a new task with this note&apos;s content, files, and links. The original note will remain unchanged.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="convert-task-title">Task title</Label>
                  <Input
                    id="convert-task-title"
                    name="title"
                    required
                    defaultValue={noteTitle}
                    placeholder="Task title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="convert-task-owner">Owner</Label>
                  <select
                    id="convert-task-owner"
                    name="owner"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    defaultValue=""
                  >
                    {ownerOptions.map((o) => (
                      <option key={o.value || "_"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="convert-task-due">Due date (optional)</Label>
                  <Input
                    id="convert-task-due"
                    name="dueDate"
                    type="date"
                    className="w-full"
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleClose(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "Create task"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
