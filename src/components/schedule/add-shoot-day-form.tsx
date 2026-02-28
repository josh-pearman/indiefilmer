"use client";

import * as React from "react";
import { createShootDay, type CreateShootDayState } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Location = { id: string; name: string };

export function AddShootDayForm({
  locations
}: {
  locations: Location[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(createShootDay, {} as CreateShootDayState);

  React.useEffect(() => {
    if (state && !state.error) setOpen(false);
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="no-print">Add Shoot Day</Button>
      </DialogTrigger>
      <DialogContent className="">
        <DialogTitle className="sr-only">Add Shoot Day</DialogTitle>
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Add Shoot Day</h2>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                defaultValue={today}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="callTime">Call Time</Label>
              <Input id="callTime" name="callTime" type="text" placeholder="e.g. 7:00 AM" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <select
                id="locationId"
                name="locationId"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">— None —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="Planned">Planned</option>
                <option value="Shooting">Shooting</option>
                <option value="Wrapped">Wrapped</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meals">Meals ($)</Label>
              <Input id="meals" name="meals" type="number" min={0} step={0.01} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport">Transport ($)</Label>
              <Input id="transport" name="transport" type="number" min={0} step={0.01} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="misc">Misc ($)</Label>
              <Input id="misc" name="misc" type="number" min={0} step={0.01} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
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
