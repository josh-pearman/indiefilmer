"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createShot,
  updateShot,
  deleteShot,
  reorderShots
} from "@/actions/scenes";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ShotData = {
  id: string;
  shotNumber: string;
  shotSize: string | null;
  shotType: string | null;
  cameraAngle: string | null;
  cameraMovement: string | null;
  lens: string | null;
  equipment: string | null;
  description: string;
  subjectOrFocus: string | null;
  notes: string | null;
  storyboardPath: string | null;
  sortOrder: number;
};

type SceneShotGroup = {
  scene: {
    id: string;
    sceneNumber: string;
    title: string | null;
    intExt: string | null;
    dayNight: string | null;
  };
  shots: ShotData[];
};

const SHOT_SIZES = ["EWS", "WS", "FS", "MWS", "MS", "MCU", "CU", "ECU"];
const SHOT_TYPES = [
  "master", "establishing", "single", "clean-single", "dirty-single",
  "two-shot", "three-shot", "group", "OTS", "clean-OTS", "POV",
  "insert", "cutaway", "reaction", "aerial"
];
const MOVEMENTS = [
  "static", "pan", "tilt", "dolly", "truck", "tracking", "handheld",
  "steadicam", "crane", "pedestal", "push-in", "pull-out", "arc",
  "whip-pan", "dolly-zoom"
];

type ShotlistEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shotsByScene: SceneShotGroup[];
  shootDayLabel: string;
};

type EditingShot = {
  id: string | null; // null = new shot
  sceneId: string;
  shotNumber: string;
  shotSize: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  equipment: string;
  description: string;
  subjectOrFocus: string;
  notes: string;
};

const emptyShot = (sceneId: string, nextNumber: string): EditingShot => ({
  id: null,
  sceneId,
  shotNumber: nextNumber,
  shotSize: "",
  shotType: "",
  cameraAngle: "",
  cameraMovement: "",
  lens: "",
  equipment: "",
  description: "",
  subjectOrFocus: "",
  notes: ""
});

function getNextShotNumber(shots: ShotData[]): string {
  if (shots.length === 0) return "1";
  const nums = shots.map((s) => parseInt(s.shotNumber, 10)).filter((n) => !isNaN(n));
  if (nums.length === 0) return String(shots.length + 1);
  return String(Math.max(...nums) + 1);
}

export function ShotlistEditorDialog({
  open,
  onOpenChange,
  shotsByScene,
  shootDayLabel
}: ShotlistEditorDialogProps) {
  const router = useRouter();
  const [expandedShotId, setExpandedShotId] = React.useState<string | null>(null);
  const [addingForScene, setAddingForScene] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<EditingShot | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [collapsedScenes, setCollapsedScenes] = React.useState<Set<string>>(new Set());
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (!open) {
      setExpandedShotId(null);
      setAddingForScene(null);
      setEditing(null);
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (addingForScene && descriptionRef.current) {
      descriptionRef.current.focus();
    }
  }, [addingForScene]);

  const toggleCollapse = (sceneId: string) => {
    setCollapsedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const handleExpandShot = (shot: ShotData, sceneId: string) => {
    if (expandedShotId === shot.id) {
      setExpandedShotId(null);
      setEditing(null);
      setError(null);
      return;
    }
    setExpandedShotId(shot.id);
    setAddingForScene(null);
    setError(null);
    setEditing({
      id: shot.id,
      sceneId,
      shotNumber: shot.shotNumber,
      shotSize: shot.shotSize ?? "",
      shotType: shot.shotType ?? "",
      cameraAngle: shot.cameraAngle ?? "",
      cameraMovement: shot.cameraMovement ?? "",
      lens: shot.lens ?? "",
      equipment: shot.equipment ?? "",
      description: shot.description,
      subjectOrFocus: shot.subjectOrFocus ?? "",
      notes: shot.notes ?? ""
    });
  };

  const handleAdd = (sceneId: string, existingShots: ShotData[]) => {
    setExpandedShotId(null);
    setAddingForScene(sceneId);
    setError(null);
    setEditing(emptyShot(sceneId, getNextShotNumber(existingShots)));
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.description.trim()) {
      setError("Description is required");
      return;
    }
    if (!editing.shotNumber.trim()) {
      setError("Shot number is required");
      return;
    }
    setError(null);
    setSaving(true);

    if (editing.id) {
      const result = await updateShot({
        id: editing.id,
        shotNumber: editing.shotNumber,
        shotSize: editing.shotSize,
        shotType: editing.shotType,
        cameraAngle: editing.cameraAngle,
        cameraMovement: editing.cameraMovement,
        lens: editing.lens,
        equipment: editing.equipment,
        description: editing.description,
        subjectOrFocus: editing.subjectOrFocus,
        notes: editing.notes
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    } else {
      const result = await createShot({
        sceneId: editing.sceneId,
        shotNumber: editing.shotNumber,
        shotSize: editing.shotSize,
        shotType: editing.shotType,
        cameraAngle: editing.cameraAngle,
        cameraMovement: editing.cameraMovement,
        lens: editing.lens,
        equipment: editing.equipment,
        description: editing.description,
        subjectOrFocus: editing.subjectOrFocus,
        notes: editing.notes
      });
      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setEditing(null);
    setExpandedShotId(null);
    setAddingForScene(null);
    router.refresh();
  };

  const handleCancel = () => {
    setEditing(null);
    setExpandedShotId(null);
    setAddingForScene(null);
    setError(null);
  };

  const handleDelete = async (shotId: string) => {
    if (!confirm("Delete this shot?")) return;
    setDeleting(shotId);
    const result = await deleteShot(shotId);
    setDeleting(null);
    if (result.error) {
      setError(result.error);
    } else {
      if (expandedShotId === shotId) {
        setExpandedShotId(null);
        setEditing(null);
      }
      router.refresh();
    }
  };

  const handleMoveUp = async (sceneId: string, shots: ShotData[], index: number) => {
    if (index === 0) return;
    const ids = shots.map((s) => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    await reorderShots(sceneId, ids);
    router.refresh();
  };

  const handleMoveDown = async (sceneId: string, shots: ShotData[], index: number) => {
    if (index >= shots.length - 1) return;
    const ids = shots.map((s) => s.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    await reorderShots(sceneId, ids);
    router.refresh();
  };

  const totalShots = shotsByScene.reduce((sum, g) => sum + g.shots.length, 0);

  const renderEditForm = () => {
    if (!editing) return null;
    return (
      <div className="space-y-3 px-1 py-3">
        <div className="flex gap-2">
          <div className="w-20 shrink-0 space-y-1">
            <Label htmlFor="edit-shotNumber" className="text-xs">Shot #</Label>
            <Input
              id="edit-shotNumber"
              value={editing.shotNumber}
              onChange={(e) => setEditing({ ...editing, shotNumber: e.target.value })}
              placeholder="1A"
              className="h-10 text-sm font-mono"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="edit-description" className="text-xs">Description *</Label>
            <textarea
              id="edit-description"
              ref={!editing.id ? descriptionRef : undefined}
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="What the camera sees..."
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="edit-shotSize" className="text-xs">Size</Label>
            <select
              id="edit-shotSize"
              value={editing.shotSize}
              onChange={(e) => setEditing({ ...editing, shotSize: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">--</option>
              {SHOT_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-shotType" className="text-xs">Type</Label>
            <select
              id="edit-shotType"
              value={editing.shotType}
              onChange={(e) => setEditing({ ...editing, shotType: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">--</option>
              {SHOT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-movement" className="text-xs">Movement</Label>
            <select
              id="edit-movement"
              value={editing.cameraMovement}
              onChange={(e) => setEditing({ ...editing, cameraMovement: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">--</option>
              {MOVEMENTS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-subject" className="text-xs">Subject</Label>
            <Input
              id="edit-subject"
              value={editing.subjectOrFocus}
              onChange={(e) => setEditing({ ...editing, subjectOrFocus: e.target.value })}
              placeholder="SARAH"
              className="h-10 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="edit-lens" className="text-xs">Lens</Label>
            <Input
              id="edit-lens"
              value={editing.lens}
              onChange={(e) => setEditing({ ...editing, lens: e.target.value })}
              placeholder="50mm"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-angle" className="text-xs">Angle</Label>
            <Input
              id="edit-angle"
              value={editing.cameraAngle}
              onChange={(e) => setEditing({ ...editing, cameraAngle: e.target.value })}
              placeholder="eye-level"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-equipment" className="text-xs">Equipment</Label>
            <Input
              id="edit-equipment"
              value={editing.equipment}
              onChange={(e) => setEditing({ ...editing, equipment: e.target.value })}
              placeholder="tripod"
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-notes" className="text-xs">Notes</Label>
            <Input
              id="edit-notes"
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="Setup notes..."
              className="h-10 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] min-w-[44px] gap-1.5"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? "Saving..." : editing.id ? "Update" : "Add Shot"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            className="min-h-[44px] min-w-[44px]"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <div className="flex items-center justify-between pb-2">
          <div>
            <DialogTitle className="text-lg font-semibold">Shot List</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {shootDayLabel} — {totalShots} shot{totalShots !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {shotsByScene.map((group) => {
            const isCollapsed = collapsedScenes.has(group.scene.id);
            return (
              <div key={group.scene.id} className="mb-3">
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.scene.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 min-h-[44px]"
                  aria-expanded={!isCollapsed}
                  aria-label={`Scene ${group.scene.sceneNumber}${group.scene.title ? `, ${group.scene.title}` : ""}, ${group.shots.length} shots`}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
                      !isCollapsed && "rotate-90"
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-sm truncate">
                    Sc. {group.scene.sceneNumber}
                    {group.scene.title ? ` — ${group.scene.title}` : ""}
                  </span>
                  {group.scene.intExt && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {group.scene.intExt}
                      {group.scene.dayNight ? ` / ${group.scene.dayNight}` : ""}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                    {group.shots.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="ml-2 border-l-2 border-border/50 pl-3">
                    {group.shots.map((shot, idx) => {
                      const isExpanded = expandedShotId === shot.id;
                      return (
                        <div key={shot.id}>
                          <div
                            className={cn(
                              "group flex items-center gap-2 rounded-md py-1",
                              isExpanded && "bg-muted/40 rounded-b-none"
                            )}
                          >
                            <div className="flex flex-col shrink-0">
                              <button
                                type="button"
                                onClick={() => handleMoveUp(group.scene.id, group.shots, idx)}
                                disabled={idx === 0}
                                className="flex h-[22px] w-[22px] items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                                aria-label={`Move shot ${shot.shotNumber} up`}
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDown(group.scene.id, group.shots, idx)}
                                disabled={idx >= group.shots.length - 1}
                                className="flex h-[22px] w-[22px] items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                                aria-label={`Move shot ${shot.shotNumber} down`}
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleExpandShot(shot, group.scene.id)}
                              className="flex flex-1 items-start gap-2 rounded-md px-2 py-2 text-left min-h-[44px] hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              aria-expanded={isExpanded}
                              aria-label={`Shot ${shot.shotNumber}, ${shot.description}. Tap to edit.`}
                            >
                              <span className="inline-flex items-center gap-1 shrink-0 rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold">
                                {shot.shotNumber}
                                {shot.shotSize && (
                                  <span className="text-muted-foreground font-normal">
                                    {shot.shotSize}
                                  </span>
                                )}
                              </span>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug line-clamp-2">
                                  {shot.description}
                                </p>
                                {(shot.subjectOrFocus || shot.cameraMovement || shot.shotType || shot.lens) && (
                                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                                    {[shot.subjectOrFocus, shot.shotType, shot.cameraMovement, shot.lens]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(shot.id)}
                              disabled={deleting === shot.id}
                              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 sm:h-8 sm:w-8 touch-manipulation"
                              aria-label={`Delete shot ${shot.shotNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {isExpanded && editing && (
                            <div className="rounded-b-md bg-muted/40 px-3 pb-3 border-b border-border/50 mb-1">
                              {renderEditForm()}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {group.shots.length === 0 && !addingForScene && (
                      <p className="py-3 text-sm text-muted-foreground">
                        No shots yet.
                      </p>
                    )}

                    {addingForScene === group.scene.id && editing && (
                      <div className="rounded-md bg-muted/40 px-3 pb-3 mb-1 border border-border/50">
                        {renderEditForm()}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleAdd(group.scene.id, group.shots)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-2.5 text-sm text-primary hover:bg-primary/5 min-h-[44px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Add shot
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {shotsByScene.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No scenes assigned to this day yet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
