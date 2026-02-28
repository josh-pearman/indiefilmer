"use client";

import * as React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCateringDay } from "@/actions/craft-services";

type AddCateringDayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function AddCateringDayDialog({
  open,
  onOpenChange,
  onSuccess
}: AddCateringDayDialogProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [dateTbd, setDateTbd] = React.useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitting(true);
    const result = await createCateringDay(formData);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
    } else {
      setDateTbd(false);
      onSuccess();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="">
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Add Catering Day</h2>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="catering-date">Date</Label>
              <Input
                id="catering-date"
                name="date"
                type="date"
                disabled={dateTbd}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={dateTbd}
                  onChange={(e) => setDateTbd(e.target.checked)}
                  className="rounded border-border"
                />
                Don&apos;t know yet
              </label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catering-label">Label</Label>
              <Input
                id="catering-label"
                name="label"
                required
                placeholder="e.g. Rehearsal, Wrap Party, Pre-Production"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catering-location">Location (optional)</Label>
              <Input
                id="catering-location"
                name="locationName"
                placeholder="e.g. Studio A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catering-headcount">Headcount</Label>
              <Input
                id="catering-headcount"
                name="headcount"
                type="number"
                min={0}
                defaultValue="0"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Day"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
