"use client";

import * as React from "react";
import { createShootDay, getScenesForLocationAction, getSceneScheduleStatusAction, type CreateShootDayState } from "@/actions/schedule";
import { linkCateringDayToShootDay } from "@/actions/craft-services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SceneChecklist } from "@/components/schedule/scene-checklist";
import type { SceneChecklistItem, ScheduleDayBadge } from "@/components/schedule/scene-checklist";

type Location = { id: string; name: string };
type UnlinkedCateringDay = { id: string; date: string; label: string };

export function ShootDayForm({
  locations,
  unlinkedCateringDays = []
}: {
  locations: Location[];
  unlinkedCateringDays?: UnlinkedCateringDay[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = React.useActionState(createShootDay, {} as CreateShootDayState);

  const [locationId, setLocationId] = React.useState("");
  const [scenes, setScenes] = React.useState<SceneChecklistItem[]>([]);
  const [scheduleStatus, setScheduleStatus] = React.useState<Record<string, ScheduleDayBadge[]>>({});
  const [checkedIds, setCheckedIds] = React.useState<string[]>([]);
  const [loadingScenes, setLoadingScenes] = React.useState(false);
  const [selectedCateringDayId, setSelectedCateringDayId] = React.useState("");

  React.useEffect(() => {
    if (state && !state.error) setOpen(false);
  }, [state]);

  React.useEffect(() => {
    if (!locationId?.trim()) {
      setScenes([]);
      setScheduleStatus({});
      setCheckedIds([]);
      return;
    }
    let cancelled = false;
    setLoadingScenes(true);
    (async () => {
      const sceneList = await getScenesForLocationAction(locationId);
      if (cancelled) return;
      const status = await getSceneScheduleStatusAction(sceneList.map((s) => s.id));
      if (cancelled) return;
      setScenes(sceneList);
      setScheduleStatus(status as Record<string, ScheduleDayBadge[]>);
      setCheckedIds([]);
      setLoadingScenes(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId]);

  const today = new Date().toISOString().slice(0, 10);

  // Wrap the form action to also handle catering day linking
  async function handleSubmit(formData: FormData) {
    // Call the original create action
    await formAction(formData);
  }

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
              <Label htmlFor="locationId">Location</Label>
              <select
                id="locationId"
                name="locationId"
                required
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">— Select location —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Call time, parking, weather…"
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>

            {locationId && (
              <div className="space-y-2">
                <Label>Scenes at this location</Label>
                <p className="text-sm text-muted-foreground">
                  Check the scenes you&apos;re shooting this day.
                </p>
                {loadingScenes ? (
                  <p className="text-sm text-muted-foreground">Loading scenes…</p>
                ) : scenes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No scenes at this location.
                  </p>
                ) : (
                  <SceneChecklist
                    scenes={scenes}
                    checkedIds={checkedIds}
                    onCheckedChange={setCheckedIds}
                    scheduleStatus={scheduleStatus}
                    showTotalPages
                  />
                )}
                {checkedIds.map((id) => (
                  <input key={id} type="hidden" name="sceneIds" value={id} />
                ))}
              </div>
            )}

            {unlinkedCateringDays.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="linkCateringDay">Link Catering Day (optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Link an existing standalone catering day to use its meal planning for this shoot day.
                </p>
                <select
                  id="linkCateringDay"
                  name="linkCateringDayId"
                  value={selectedCateringDayId}
                  onChange={(e) => setSelectedCateringDayId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">— None (create new) —</option>
                  {unlinkedCateringDays.map((cd) => (
                    <option key={cd.id} value={cd.id}>
                      {cd.label} ({cd.date})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={!locationId?.trim()}>
                Create
              </Button>
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
