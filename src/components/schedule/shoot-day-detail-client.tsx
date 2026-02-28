"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateShootDay, deleteShootDay, restoreShootDay, assignScenesToDay, assignCrewToDay } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SceneChecklist } from "@/components/schedule/scene-checklist";
import type { SceneChecklistItem, ScheduleDayBadge } from "@/components/schedule/scene-checklist";

type ShootDayFormData = {
  id: string;
  date: string;
  callTime: string;
  locationId: string;
  status: string;
  notes: string;
  meals: number;
  transport: number;
  misc: number;
  isDeleted: boolean;
};

type LocationOption = { id: string; name: string };
type CastNeededItem = { roleName: string; actorName: string | null };
type CrewOption = { id: string; name: string; position: string };

export function ShootDayDetailClient({
  shootDay,
  dayNumber,
  locationName,
  assignedSceneIds,
  scenesAtLocation,
  scheduleStatus,
  locations,
  castNeeded,
  totalPages: _totalPages,
  crew,
  assignedCrewIds
}: {
  shootDay: ShootDayFormData;
  dayNumber: number;
  locationName: string | null;
  assignedSceneIds: string[];
  scenesAtLocation: SceneChecklistItem[];
  scheduleStatus: Record<string, ScheduleDayBadge[]>;
  locations: LocationOption[];
  castNeeded: CastNeededItem[];
  totalPages: number;
  crew: CrewOption[];
  assignedCrewIds: string[];
}) {
  const router = useRouter();
  const [sceneIds, setSceneIds] = React.useState<string[]>(assignedSceneIds);
  const [sceneSaveError, setSceneSaveError] = React.useState<string | null>(null);
  const [sceneSaving, setSceneSaving] = React.useState(false);
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const [crewIds, setCrewIds] = React.useState<string[]>(assignedCrewIds);
  const [crewSaveError, setCrewSaveError] = React.useState<string | null>(null);
  const [crewSaving, setCrewSaving] = React.useState(false);

  React.useEffect(() => {
    setSceneIds(assignedSceneIds);
  }, [assignedSceneIds.join(",")]);

  React.useEffect(() => {
    setCrewIds(assignedCrewIds);
  }, [assignedCrewIds.join(",")]);

  const effectiveTotalPages = React.useMemo(() => {
    return sceneIds.reduce((sum, id) => {
      const s = scenesAtLocation.find((sc) => sc.id === id);
      return sum + (s?.pageCount ?? 0);
    }, 0);
  }, [sceneIds, scenesAtLocation]);

  const sceneIdsChanged =
    sceneIds.length !== assignedSceneIds.length ||
    sceneIds.some((id, i) => id !== assignedSceneIds[i]);

  const crewIdsChanged =
    crewIds.length !== assignedCrewIds.length ||
    crewIds.some((id, i) => id !== assignedCrewIds[i]);

  const handleSaveCrew = async () => {
    setCrewSaveError(null);
    setCrewSaving(true);
    const result = await assignCrewToDay(shootDay.id, crewIds);
    setCrewSaving(false);
    if (result.error) setCrewSaveError(result.error);
    else router.refresh();
  };

  const toggleCrew = (crewMemberId: string) => {
    if (shootDay.isDeleted) return;
    setCrewIds((prev) =>
      prev.includes(crewMemberId)
        ? prev.filter((id) => id !== crewMemberId)
        : [...prev, crewMemberId]
    );
  };

  const handleSaveScenes = async () => {
    setSceneSaveError(null);
    setSceneSaving(true);
    const result = await assignScenesToDay(shootDay.id, sceneIds);
    setSceneSaving(false);
    if (result.error) setSceneSaveError(result.error);
    else router.refresh();
  };

  const handleSaveMetadata = async (formData: FormData) => {
    setUpdateError(null);
    const newLocationId = (formData.get("locationId") as string) || "";
    if (
      newLocationId !== shootDay.locationId &&
      assignedSceneIds.length > 0 &&
      !confirm("Changing location will clear scene assignments for this day. Continue?")
    ) {
      return;
    }
    const result = await updateShootDay(shootDay.id, formData);
    if (result.error) setUpdateError(result.error);
    else {
      if (newLocationId !== shootDay.locationId) {
        await assignScenesToDay(shootDay.id, []);
      }
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!confirm("Soft delete this shoot day? It will be hidden from the list.")) return;
    const result = await deleteShootDay(shootDay.id);
    if (result.error) setUpdateError(result.error);
    else router.push("/production/schedule");
  };

  const handleRestore = async () => {
    const result = await restoreShootDay(shootDay.id);
    if (result.error) setUpdateError(result.error);
    else router.refresh();
  };

  return (
    <div className="space-y-6">
      {shootDay.isDeleted && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">This shoot day has been deleted.</span>{" "}
          <Button type="button" variant="outline" size="sm" onClick={handleRestore} className="ml-2">
            Restore
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Shoot Day Details</CardTitle>
          {dayNumber > 0 && (
            <p className="text-sm text-muted-foreground">Day {dayNumber}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={handleSaveMetadata}
            className="grid gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="status" value={shootDay.status} />
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={shootDay.date} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locationId">Location</Label>
              <select
                id="locationId"
                name="locationId"
                defaultValue={shootDay.locationId || ""}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">— None —</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={shootDay.notes}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            {updateError && <p className="text-sm text-destructive sm:col-span-2">{updateError}</p>}
            <div className="flex gap-2 sm:col-span-2 no-print">
              <Button type="submit">Save changes</Button>
              {!shootDay.isDeleted && (
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  Delete shoot day
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {shootDay.locationId && (
        <Card>
          <CardHeader>
            <CardTitle>Scenes at this location</CardTitle>
            <p className="text-sm text-muted-foreground">
              Check the scenes you&apos;re shooting this day. Sort by scene number.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {scenesAtLocation.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scenes at this location. Change the location above or add scenes to this location in the Scenes module.
              </p>
            ) : (
              <>
                <SceneChecklist
                  scenes={scenesAtLocation}
                  checkedIds={sceneIds}
                  onCheckedChange={setSceneIds}
                  scheduleStatus={scheduleStatus}
                  showTotalPages={false}
                  disabled={shootDay.isDeleted}
                />
                <p className="text-sm text-muted-foreground border-t border-border pt-2">
                  Total: {effectiveTotalPages.toFixed(1)} pages ({sceneIds.length} scene{sceneIds.length !== 1 ? "s" : ""})
                </p>
                {sceneIdsChanged && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveScenes}
                      disabled={sceneSaving || shootDay.isDeleted}
                    >
                      {sceneSaving ? "Saving…" : "Save scene assignments"}
                    </Button>
                  </div>
                )}
                {sceneSaveError && <p className="text-sm text-destructive">{sceneSaveError}</p>}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Crew</CardTitle>
          <p className="text-sm text-muted-foreground">
            Assign crew members to this shoot day. Changes apply to call sheets and craft services headcount.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {crew.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No crew members yet. Add crew in the Crew module.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {crew.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={crewIds.includes(c.id)}
                      onChange={() => toggleCrew(c.id)}
                      disabled={shootDay.isDeleted}
                      className="h-4 w-4 rounded border-border"
                      aria-label={`Assign ${c.name} to this day`}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{c.position}</span>
                  </li>
                ))}
              </ul>
              {crewIdsChanged && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveCrew}
                    disabled={crewSaving || shootDay.isDeleted}
                  >
                    {crewSaving ? "Saving…" : "Save crew assignments"}
                  </Button>
                </div>
              )}
              {crewSaveError && <p className="text-sm text-destructive">{crewSaveError}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {castNeeded.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cast needed</CardTitle>
            <p className="text-sm text-muted-foreground">
              From the scenes assigned to this day (deduplicated).
            </p>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc text-sm">
              {castNeeded.map((c, i) => (
                <li key={i}>
                  {c.actorName ? `${c.actorName} (${c.roleName})` : c.roleName}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
