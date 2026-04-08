"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createShot,
  updateShot,
  deleteShot,
  reorderShots,
  clearShotsForShootDay,
  importShots
} from "@/actions/scenes";
import { ShotlistGenerateDialog } from "@/components/schedule/shotlist-generate-dialog";
import { exportShotlistCSV, exportShotlistPrint } from "@/lib/shotlist-export";
import { SHOTLIST_PROFILES } from "@/lib/shotlist-profiles";
import { buildShotlistPrompt } from "@/lib/shotlist-prompt";
import type { ShotlistSceneContext } from "@/lib/shotlist-prompt";
import { Plus, Trash2, GripVertical, Check, X, Download, Printer, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────

type ShotData = {
  id: string;
  shotNumber: string;
  shotSize: string | null;
  cameraAngle: string | null;
  cameraMovement: string | null;
  lens: string | null;
  description: string;
  subjectOrFocus: string | null;
  notes: string | null;
  sortOrder: number;
};

type SceneInfo = {
  id: string;
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
};

type SceneShotGroup = {
  scene: SceneInfo;
  shots: ShotData[];
};

type EditingShot = {
  id: string | null;
  sceneId: string;
  shotNumber: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  description: string;
  subjectOrFocus: string;
  notes: string;
};

const SHOT_SIZES = ["WS", "MWS", "MS", "MCU", "CU", "ECU", "OTS", "POV", "AERIAL", "INSERT"];
const MOVEMENTS = ["static", "pan", "tilt", "dolly", "tracking", "handheld", "steadicam", "crane"];

function getNextShotNumber(shots: ShotData[]): string {
  if (shots.length === 0) return "1";
  const nums = shots.map((s) => parseInt(s.shotNumber, 10)).filter((n) => !isNaN(n));
  if (nums.length === 0) return String(shots.length + 1);
  return String(Math.max(...nums) + 1);
}

// ─── Props ──────────────────────────────────────────────

type ShotListPageClientProps = {
  shootDayId: string;
  dayNumber: number;
  scenes: SceneInfo[];
  shotsByScene: SceneShotGroup[];
  shotlistSceneContext: ShotlistSceneContext[];
  sceneNumberToId: Record<string, string>;
  totalShotCount: number;
  generationMode: "cli" | "api" | "off";
};

export function ShotListPageClient({
  shootDayId,
  dayNumber,
  scenes,
  shotsByScene: serverShotsByScene,
  shotlistSceneContext,
  sceneNumberToId,
  totalShotCount,
  generationMode
}: ShotListPageClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [activeSceneId, setActiveSceneId] = React.useState<string>(
    scenes[0]?.id ?? ""
  );
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = React.useState("standard");
  const [editing, setEditing] = React.useState<EditingShot | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  // Optimistic local state for shots
  const [localShots, setLocalShots] = React.useState(serverShotsByScene);
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null);

  // Hydration fix for @hello-pangea/dnd
  React.useEffect(() => setMounted(true), []);

  // Sync with server data
  React.useEffect(() => {
    setLocalShots(serverShotsByScene);
  }, [serverShotsByScene]);

  // Focus description on new shot
  React.useEffect(() => {
    if (editing && !editing.id && descriptionRef.current) {
      descriptionRef.current.focus();
    }
  }, [editing?.id]);

  const activeGroup = localShots.find((g) => g.scene.id === activeSceneId);
  const activeShots = activeGroup?.shots ?? [];

  // ─── DnD ────────────────────────────────────────────

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !activeGroup) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    // Optimistic reorder
    const reordered = [...activeShots];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    setLocalShots((prev) =>
      prev.map((g) =>
        g.scene.id === activeSceneId ? { ...g, shots: reordered } : g
      )
    );

    // Persist
    await reorderShots(activeSceneId, reordered.map((s) => s.id));
    router.refresh();
  };

  // ─── CRUD ───────────────────────────────────────────

  const handleAdd = () => {
    setError(null);
    setEditing({
      id: null,
      sceneId: activeSceneId,
      shotNumber: getNextShotNumber(activeShots),
      shotSize: "",
      cameraAngle: "",
      cameraMovement: "",
      lens: "",
      description: "",
      subjectOrFocus: "",
      notes: ""
    });
  };

  const handleEdit = (shot: ShotData) => {
    setError(null);
    setEditing({
      id: shot.id,
      sceneId: activeSceneId,
      shotNumber: shot.shotNumber,
      shotSize: shot.shotSize ?? "",
      cameraAngle: shot.cameraAngle ?? "",
      cameraMovement: shot.cameraMovement ?? "",
      lens: shot.lens ?? "",
      description: shot.description,
      subjectOrFocus: shot.subjectOrFocus ?? "",
      notes: shot.notes ?? ""
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.description.trim()) {
      setError("Description is required");
      return;
    }
    setSaving(true);
    setError(null);

    const result = editing.id
      ? await updateShot({
          id: editing.id,
          shotNumber: editing.shotNumber,
          shotSize: editing.shotSize,
          cameraAngle: editing.cameraAngle,
          cameraMovement: editing.cameraMovement,
          lens: editing.lens,
          description: editing.description,
          subjectOrFocus: editing.subjectOrFocus,
          notes: editing.notes
        })
      : await createShot({
          sceneId: editing.sceneId,
          shotNumber: editing.shotNumber,
          shotSize: editing.shotSize,
          cameraAngle: editing.cameraAngle,
          cameraMovement: editing.cameraMovement,
          lens: editing.lens,
          description: editing.description,
          subjectOrFocus: editing.subjectOrFocus,
          notes: editing.notes
        });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  };

  const handleDelete = async (shotId: string) => {
    if (!confirm("Delete this shot?")) return;
    setDeleting(shotId);
    await deleteShot(shotId);
    setDeleting(null);
    if (editing?.id === shotId) setEditing(null);
    router.refresh();
  };

  const handleCancel = () => {
    setEditing(null);
    setError(null);
  };

  // ─── Auto-generate (CLI/API mode) ──────────────────

  const canAutoGenerate = generationMode !== "off" && shotlistSceneContext.length > 0;

  const handleAutoGenerate = async () => {
    if (!canAutoGenerate) return;

    const profile = SHOTLIST_PROFILES.find((p) => p.id === selectedProfileId) ?? SHOTLIST_PROFILES[0];
    const prompt = buildShotlistPrompt(shotlistSceneContext, profile, `Day ${dayNumber}`);

    setGenerating(true);
    setGenerateError(null);

    try {
      // Clear existing shots if any
      if (totalShotCount > 0) {
        const clearResult = await clearShotsForShootDay(shootDayId);
        if (clearResult.error) {
          setGenerateError(clearResult.error);
          setGenerating(false);
          return;
        }
      }

      const response = await fetch("/api/shotlist/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Generation failed" }));
        setGenerateError(err.error ?? `HTTP ${response.status}`);
        setGenerating(false);
        return;
      }

      const data = await response.json();
      const text = data.text;

      if (!text) {
        setGenerateError("Empty response from AI");
        setGenerating(false);
        return;
      }

      // Import the JSON
      const importResult = await importShots(text, sceneNumberToId);
      if (!importResult.success) {
        setGenerateError(importResult.errors?.join("; ") ?? "Import failed");
        setGenerating(false);
        return;
      }

      setGenerating(false);
      router.refresh();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed");
      setGenerating(false);
    }
  };

  // ─── Render ─────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button size="sm" onClick={handleAdd} disabled={!activeSceneId}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Shot
        </Button>

        {canAutoGenerate ? (
          <>
            {/* Profile picker + auto-generate */}
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              disabled={generating}
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              aria-label="Shooting profile"
            >
              {SHOTLIST_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={handleAutoGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                totalShotCount > 0 ? "Regenerate" : "Generate"
              )}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGenerateOpen(true)}
            disabled={shotlistSceneContext.length === 0}
          >
            {totalShotCount > 0 ? "AI Regenerate" : "AI Generate"}
          </Button>
        )}

        <div className="flex-1" />
        {totalShotCount > 0 && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportShotlistCSV(localShots, `Day ${dayNumber}`)}
              aria-label="Export CSV"
            >
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportShotlistPrint(localShots, `Day ${dayNumber}`)}
              aria-label="Print shot list"
            >
              <Printer className="mr-1.5 h-4 w-4" />
              Print
            </Button>
          </>
        )}
      </div>

      {/* Generation status */}
      {generating && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Generating shot list… This may take a minute or two depending on the number of scenes.</span>
          </div>
        </div>
      )}

      {generateError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">Generation failed</p>
          <p className="mt-1 text-destructive/80">{generateError}</p>
        </div>
      )}

      {/* Scene tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border pb-px no-print">
        {scenes.map((scene) => {
          const shotCount = localShots.find((g) => g.scene.id === scene.id)?.shots.length ?? 0;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => {
                setActiveSceneId(scene.id);
                setEditing(null);
                setError(null);
              }}
              className={cn(
                "shrink-0 rounded-t-md border border-b-0 px-3 py-2 text-sm font-medium transition-colors",
                activeSceneId === scene.id
                  ? "border-border bg-background text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              Sc. {scene.sceneNumber}
              {scene.title ? (
                <span className="ml-1.5 hidden font-normal text-muted-foreground sm:inline">
                  {scene.title}
                </span>
              ) : null}
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {shotCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active scene info */}
      {activeGroup && (
        <div className="text-sm text-muted-foreground">
          Scene {activeGroup.scene.sceneNumber}
          {activeGroup.scene.title ? ` — ${activeGroup.scene.title}` : ""}
          {activeGroup.scene.intExt ? ` · ${activeGroup.scene.intExt}` : ""}
          {activeGroup.scene.dayNight ? ` / ${activeGroup.scene.dayNight}` : ""}
        </div>
      )}

      {/* Shot list with DnD */}
      <div className="rounded-lg border border-border bg-background">
        {mounted && activeSceneId ? (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId={activeSceneId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "min-h-[100px] divide-y divide-border/50 transition-colors",
                    snapshot.isDraggingOver && "bg-muted/20"
                  )}
                >
                  {activeShots.length === 0 && !editing && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No shots for this scene yet
                      </p>
                      <Button size="sm" variant="outline" onClick={handleAdd}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add first shot
                      </Button>
                    </div>
                  )}

                  {activeShots.map((shot, index) => (
                    <Draggable key={shot.id} draggableId={shot.id} index={index}>
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={cn(
                            "group transition-shadow",
                            dragSnapshot.isDragging && "shadow-lg rounded-lg bg-background ring-1 ring-border"
                          )}
                        >
                          {/* Shot row */}
                          <div className="flex items-start gap-3 px-4 py-3">
                            {/* Drag handle */}
                            <div
                              {...dragProvided.dragHandleProps}
                              className="mt-1 cursor-grab text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
                              aria-label={`Drag to reorder shot ${shot.shotNumber}`}
                            >
                              <GripVertical className="h-5 w-5" />
                            </div>

                            {/* Shot badge */}
                            <div className="shrink-0 mt-0.5">
                              <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-mono font-semibold">
                                {shot.shotNumber}
                                {shot.shotSize && (
                                  <span className="rounded bg-background px-1 py-px text-[10px] font-medium text-muted-foreground">
                                    {shot.shotSize}
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm leading-relaxed">{shot.description}</p>
                              {(shot.subjectOrFocus || shot.cameraMovement || shot.lens || shot.cameraAngle) && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {[
                                    shot.subjectOrFocus,
                                    shot.cameraMovement,
                                    shot.cameraAngle,
                                    shot.lens
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                              {shot.notes && (
                                <p className="mt-1 text-xs italic text-muted-foreground/70">
                                  {shot.notes}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs"
                                onClick={() => handleEdit(shot)}
                              >
                                Edit
                              </Button>
                              <button
                                type="button"
                                onClick={() => handleDelete(shot.id)}
                                disabled={deleting === shot.id}
                                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Delete shot ${shot.shotNumber}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {editing?.id === shot.id && (
                            <div className="border-t border-border/50 bg-muted/10 px-4 py-3">
                              <ShotEditForm
                                editing={editing}
                                setEditing={setEditing}
                                onSave={handleSave}
                                onCancel={handleCancel}
                                saving={saving}
                                error={error}
                                descriptionRef={null}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {scenes.length === 0
              ? "No scenes assigned to this shoot day."
              : "Loading..."}
          </div>
        )}

        {/* New shot form at bottom */}
        {editing && !editing.id && (
          <div className="border-t border-border bg-muted/10 px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New Shot
            </p>
            <ShotEditForm
              editing={editing}
              setEditing={setEditing}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
              error={error}
              descriptionRef={descriptionRef}
            />
          </div>
        )}
      </div>

      {/* Generate dialog */}
      {shotlistSceneContext.length > 0 && (
        <ShotlistGenerateDialog
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          shootDayId={shootDayId}
          shootDayLabel={`Day ${dayNumber}`}
          scenes={shotlistSceneContext}
          sceneNumberToId={sceneNumberToId}
          hasExistingShots={totalShotCount > 0}
        />
      )}
    </div>
  );
}

// ─── Shared edit form ───────────────────────────────────

function ShotEditForm({
  editing,
  setEditing,
  onSave,
  onCancel,
  saving,
  error,
  descriptionRef
}: {
  editing: EditingShot;
  setEditing: (e: EditingShot) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  descriptionRef: React.RefObject<HTMLTextAreaElement> | null;
}) {
  return (
    <div className="space-y-3">
      {/* Row 1: Shot # + Description */}
      <div className="flex gap-3">
        <div className="w-20 shrink-0 space-y-1">
          <Label className="text-xs">Shot #</Label>
          <Input
            value={editing.shotNumber}
            onChange={(e) => setEditing({ ...editing, shotNumber: e.target.value })}
            placeholder="1A"
            className="h-9 text-sm font-mono"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Description *</Label>
          <textarea
            ref={descriptionRef}
            value={editing.description}
            onChange={(e) => setEditing({ ...editing, description: e.target.value })}
            placeholder="What the camera sees..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Row 2: Quick metadata */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs">Size</Label>
          <select
            value={editing.shotSize}
            onChange={(e) => setEditing({ ...editing, shotSize: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">--</option>
            {SHOT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Movement</Label>
          <select
            value={editing.cameraMovement}
            onChange={(e) => setEditing({ ...editing, cameraMovement: e.target.value })}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">--</option>
            {MOVEMENTS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Input
            value={editing.subjectOrFocus}
            onChange={(e) => setEditing({ ...editing, subjectOrFocus: e.target.value })}
            placeholder="SARAH"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lens</Label>
          <Input
            value={editing.lens}
            onChange={(e) => setEditing({ ...editing, lens: e.target.value })}
            placeholder="50mm"
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Row 3: Secondary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Angle</Label>
          <Input
            value={editing.cameraAngle}
            onChange={(e) => setEditing({ ...editing, cameraAngle: e.target.value })}
            placeholder="eye-level, low, high..."
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Notes</Label>
          <Input
            value={editing.notes}
            onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
            placeholder="Setup notes..."
            className="h-9 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {editing.id ? "Update" : "Add Shot"}
            </>
          )}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
