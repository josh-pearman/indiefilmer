"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { deleteUnassignedTasks } from "@/actions/generate-tasks";

export function DeleteUnassignedButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<number | null>(null);

  async function handleDelete() {
    setPending(true);
    const res = await deleteUnassignedTasks();
    setPending(false);
    setOpen(false);
    setResult(res.deleted);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Delete All Unassigned Tasks
      </Button>
      {result !== null && (
        <p className="text-sm text-muted-foreground">
          {result > 0
            ? `Deleted ${result} unassigned task${result === 1 ? "" : "s"}.`
            : "No unassigned tasks to delete."}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Delete unassigned tasks?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all tasks that have no owner assigned.
              Associated links and files will also be removed. This cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={pending}
              >
                {pending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
