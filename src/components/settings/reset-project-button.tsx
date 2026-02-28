"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { resetProject } from "@/actions/settings";

type ResetProjectButtonProps = {
  projectName: string;
};

export function ResetProjectButton({ projectName }: ResetProjectButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const matches = projectName.trim() !== "" && confirmText.trim() === projectName.trim();

  async function handleReset() {
    if (!matches) return;
    setError(null);
    setPending(true);
    const result = await resetProject(confirmText.trim());
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setConfirmText("");
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="font-semibold"
        onClick={() => {
          setOpen(true);
          setConfirmText("");
          setError(null);
        }}
      >
        Reset Entire Project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-destructive">
              Reset entire project?
            </h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete ALL project data — scenes, cast,
              crew, locations, shoot days, budget items, tasks, notes,
              files, audit log, and all settings. The app will return to a
              blank state. This cannot be undone.
            </p>
            <div>
              <Label htmlFor="confirmReset">
                Type &quot;{projectName}&quot; to confirm
              </Label>
              <Input
                id="confirmReset"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={projectName}
                className="mt-1 font-mono"
                autoComplete="off"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={!matches || pending}
              >
                {pending ? "Resetting…" : "Reset Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
