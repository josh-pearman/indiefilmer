"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  purgeDeletedRecords,
  getDeletedCounts
} from "@/actions/settings";

type PurgeDeletedButtonProps = {
  counts: Record<string, number>;
};

const LABELS: Record<string, string> = {
  scenes: "scenes",
  cast: "cast members",
  crew: "crew members",
  locations: "locations",
  shootDays: "shoot days",
  tasks: "tasks",
  lineItems: "line items",
  scriptVersions: "script versions",
  vaultFiles: "vault files",
  notes: "notes"
};

export function PurgeDeletedButton({ counts: initialCounts }: PurgeDeletedButtonProps) {
  const router = useRouter();
  const [counts, setCounts] = React.useState(initialCounts);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const lines = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${LABELS[k] ?? k}`);

  async function handlePurge() {
    setPending(true);
    const result = await purgeDeletedRecords();
    setPending(false);
    setOpen(false);
    if (result.success) {
      setCounts({
        scenes: 0,
        cast: 0,
        crew: 0,
        locations: 0,
        shootDays: 0,
        tasks: 0,
        lineItems: 0,
        scriptVersions: 0,
        vaultFiles: 0,
        notes: 0
      });
      router.refresh();
    }
  }

  if (total === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No deleted records to purge.
      </div>
    );
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Purge Deleted Records
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Purge deleted records?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all records currently in the trash
              (soft-deleted). This cannot be undone.
            </p>
            <p className="text-sm">
              Count: {lines.join(", ")}.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handlePurge}
                disabled={pending}
              >
                {pending ? "Purging…" : "Purge"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
