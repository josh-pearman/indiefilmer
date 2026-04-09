"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createShot,
  updateShot,
  deleteShot,
  reorderShots,
  clearShotsForShootDay,
  importShots,
  uploadShotImage,
  removeShotImage
} from "@/actions/scenes";
import { ShotlistGenerateDialog } from "@/components/schedule/shotlist-generate-dialog";
import { exportShotlistCSV, exportShotlistPrint } from "@/lib/shotlist-export";
import { SHOTLIST_PROFILES } from "@/lib/shotlist-profiles";
import { buildShotlistPrompt } from "@/lib/shotlist-prompt";
import type { ShotlistSceneContext } from "@/lib/shotlist-prompt";
import {
  Plus, Trash2, GripVertical, Check, Download, Printer, Loader2,
  ChevronRight, ChevronUp, ChevronDown, Columns3, ArrowLeft, ImagePlus, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Types ──────────────────────────────────────────────

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
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  lens: string;
  equipment: string;
  description: string;
  subjectOrFocus: string;
  notes: string;
};

// ─── Constants ──────────────────────────────────────────

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

const ANGLES = [
  "eye-level", "low", "high", "dutch", "bird's-eye", "worm's-eye",
  "overhead", "hip-level", "knee-level", "ground-level"
];

const EQUIPMENT = [
  "tripod", "dolly", "slider", "steadicam rig", "crane", "jib",
  "drone", "handheld", "sticks", "monopod"
];

// ─── Image sizes ────────────────────────────────────────

type ImageSize = "sm" | "md" | "lg";
const IMAGE_SIZES: Record<ImageSize, { w: string; h: string; colW: string; label: string }> = {
  sm: { w: "w-36", h: "h-24", colW: "w-[9.5rem]", label: "S" },
  md: { w: "w-72", h: "h-48", colW: "w-[18.5rem]", label: "M" },
  lg: { w: "w-[27rem]", h: "h-72", colW: "w-[27.5rem]", label: "L" },
};
const IMAGE_SIZE_KEY = "shotlist-image-size";

function loadImageSize(): ImageSize {
  if (typeof window === "undefined") return "sm";
  const v = localStorage.getItem(IMAGE_SIZE_KEY);
  return v === "sm" || v === "md" || v === "lg" ? v : "sm";
}

// ─── Column definitions ─────────────────────────────────

type ColumnKey =
  | "image" | "shotNumber" | "shotSize" | "shotType" | "description" | "subjectOrFocus"
  | "cameraMovement" | "cameraAngle" | "lens" | "equipment" | "notes";

type ColumnDef = {
  key: ColumnKey;
  label: string;
  shortLabel: string;
  defaultVisible: boolean;
  minWidth: string;
  type: "text" | "select" | "image";
  options?: string[];
  placeholder?: string;
};

const COLUMNS: ColumnDef[] = [
  { key: "image", label: "Image", shortLabel: "Img", defaultVisible: false, minWidth: "w-16", type: "image" },
  { key: "shotNumber", label: "Shot #", shortLabel: "#", defaultVisible: true, minWidth: "w-16", type: "text", placeholder: "1A" },
  { key: "shotSize", label: "Shot Size", shortLabel: "Size", defaultVisible: true, minWidth: "w-20", type: "select", options: SHOT_SIZES },
  { key: "shotType", label: "Shot Type", shortLabel: "Type", defaultVisible: true, minWidth: "w-28", type: "select", options: SHOT_TYPES },
  { key: "description", label: "Description", shortLabel: "Description", defaultVisible: true, minWidth: "min-w-[200px] flex-1", type: "text", placeholder: "What the camera sees..." },
  { key: "subjectOrFocus", label: "Subject", shortLabel: "Subject", defaultVisible: true, minWidth: "w-24", type: "text", placeholder: "SARAH" },
  { key: "cameraMovement", label: "Movement", shortLabel: "Move", defaultVisible: true, minWidth: "w-28", type: "select", options: MOVEMENTS },
  { key: "cameraAngle", label: "Camera Angle", shortLabel: "Angle", defaultVisible: false, minWidth: "w-28", type: "select", options: ANGLES },
  { key: "lens", label: "Lens", shortLabel: "Lens", defaultVisible: false, minWidth: "w-20", type: "text", placeholder: "50mm" },
  { key: "equipment", label: "Equipment", shortLabel: "Equip", defaultVisible: false, minWidth: "w-28", type: "select", options: EQUIPMENT },
  { key: "notes", label: "Notes", shortLabel: "Notes", defaultVisible: false, minWidth: "w-32", type: "text", placeholder: "Setup notes..." },
];

const STORAGE_KEY = "shotlist-columns-v2";
const ALL_KEYS = COLUMNS.map((c) => c.key);

type ColumnConfig = { order: ColumnKey[]; hidden: Set<ColumnKey> };

function getDefaultConfig(): ColumnConfig {
  return {
    order: ALL_KEYS.slice(),
    hidden: new Set(COLUMNS.filter((c) => !c.defaultVisible).map((c) => c.key))
  };
}

function loadColumnConfig(): ColumnConfig {
  if (typeof window === "undefined") return getDefaultConfig();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as { order?: string[]; hidden?: string[] };
      const validKeys = new Set(ALL_KEYS);
      let order = (data.order ?? []).filter((k) => validKeys.has(k as ColumnKey)) as ColumnKey[];
      // Add any missing keys at the end
      for (const k of ALL_KEYS) {
        if (!order.includes(k)) order.push(k);
      }
      const hidden = new Set((data.hidden ?? []).filter((k) => validKeys.has(k as ColumnKey))) as Set<ColumnKey>;
      // Never hide required columns
      hidden.delete("shotNumber");
      hidden.delete("description");
      return { order, hidden };
    }
  } catch { /* ignore */ }
  return getDefaultConfig();
}

function saveColumnConfig(config: ColumnConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      order: config.order,
      hidden: [...config.hidden]
    }));
  } catch { /* ignore */ }
}

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
  dateStr: string;
  locationName: string | null;
  backHref: string;
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
  dateStr,
  locationName,
  backHref,
  scenes,
  shotsByScene: serverShotsByScene,
  shotlistSceneContext,
  sceneNumberToId,
  totalShotCount,
  generationMode
}: ShotListPageClientProps) {
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = React.useState("standard");
  const [editing, setEditing] = React.useState<EditingShot | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [localShots, setLocalShots] = React.useState(serverShotsByScene);
  const [collapsedScenes, setCollapsedScenes] = React.useState<Set<string>>(new Set());
  const [columnConfig, setColumnConfig] = React.useState<ColumnConfig>(getDefaultConfig);
  const [imageSize, setImageSize] = React.useState<ImageSize>("sm");
  const [showColumnPicker, setShowColumnPicker] = React.useState(false);
  const [lightboxSrc, setLightboxSrc] = React.useState<string | null>(null);
  const [lightboxLabel, setLightboxLabel] = React.useState("");
  const columnPickerRef = React.useRef<HTMLDivElement>(null);
  const editRowRef = React.useRef<HTMLDivElement>(null);
  const editingRef = React.useRef<EditingShot | null>(null);
  // Keep ref in sync so blur handler always has latest editing state
  editingRef.current = editing;

  React.useEffect(() => {
    setMounted(true);
    setColumnConfig(loadColumnConfig());
    setImageSize(loadImageSize());
  }, []);

  React.useEffect(() => {
    setLocalShots(serverShotsByScene);
  }, [serverShotsByScene]);

  // Close column picker on outside click
  React.useEffect(() => {
    if (!showColumnPicker) return;
    const handler = (e: MouseEvent) => {
      if (columnPickerRef.current && !columnPickerRef.current.contains(e.target as Node)) {
        setShowColumnPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColumnPicker]);

  const activeColumns = columnConfig.order
    .filter((k) => !columnConfig.hidden.has(k))
    .map((k) => COLUMNS.find((c) => c.key === k)!)
    .filter(Boolean);

  const updateConfig = (fn: (prev: ColumnConfig) => ColumnConfig) => {
    setColumnConfig((prev) => {
      const next = fn(prev);
      saveColumnConfig(next);
      return next;
    });
  };

  const toggleColumn = (key: ColumnKey) => {
    if (key === "shotNumber" || key === "description") return;
    updateConfig((prev) => {
      const hidden = new Set(prev.hidden);
      if (hidden.has(key)) hidden.delete(key);
      else hidden.add(key);
      return { ...prev, hidden };
    });
  };

  const moveColumn = (key: ColumnKey, direction: -1 | 1) => {
    updateConfig((prev) => {
      const order = [...prev.order];
      const idx = order.indexOf(key);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= order.length) return prev;
      [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
      return { ...prev, order };
    });
  };

  const colWidth = (col: ColumnDef): string =>
    col.key === "image" ? IMAGE_SIZES[imageSize].colW : col.minWidth;

  const toggleCollapse = (sceneId: string) => {
    setCollapsedScenes((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  // ─── DnD ────────────────────────────────────────────

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const sceneId = result.source.droppableId;
    const group = localShots.find((g) => g.scene.id === sceneId);
    if (!group) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const reordered = [...group.shots];
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    setLocalShots((prev) =>
      prev.map((g) =>
        g.scene.id === sceneId ? { ...g, shots: reordered } : g
      )
    );

    await reorderShots(sceneId, reordered.map((s) => s.id));
    router.refresh();
  };

  // ─── CRUD ───────────────────────────────────────────

  const handleAdd = (sceneId: string) => {
    const group = localShots.find((g) => g.scene.id === sceneId);
    setError(null);
    setEditing({
      id: null,
      sceneId,
      shotNumber: getNextShotNumber(group?.shots ?? []),
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
  };

  const handleEdit = (shot: ShotData, sceneId: string) => {
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

  // Auto-save: persist the current editing state to the server
  const saveEditing = React.useCallback(async (data: EditingShot) => {
    if (!data.description.trim()) return; // skip empty
    setSaving(true);
    const result = data.id
      ? await updateShot({
          id: data.id,
          shotNumber: data.shotNumber,
          shotSize: data.shotSize,
          shotType: data.shotType,
          cameraAngle: data.cameraAngle,
          cameraMovement: data.cameraMovement,
          lens: data.lens,
          equipment: data.equipment,
          description: data.description,
          subjectOrFocus: data.subjectOrFocus,
          notes: data.notes
        })
      : await createShot({
          sceneId: data.sceneId,
          shotNumber: data.shotNumber,
          shotSize: data.shotSize,
          shotType: data.shotType,
          cameraAngle: data.cameraAngle,
          cameraMovement: data.cameraMovement,
          lens: data.lens,
          equipment: data.equipment,
          description: data.description,
          subjectOrFocus: data.subjectOrFocus,
          notes: data.notes
        });
    setSaving(false);
    if (!result.error) router.refresh();
  }, [router]);

  // Blur handler: auto-save when clicking outside the edit row
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const current = editingRef.current;
      if (!current) return;
      if (editRowRef.current && editRowRef.current.contains(e.target as Node)) return;
      // Clicking another shot row or outside — save and close
      setEditing(null);
      setError(null);
      saveEditing(current);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [saveEditing]);

  // Save new shot explicitly (need at least a description)
  const handleSaveNew = async () => {
    if (!editing || editing.id) return;
    if (!editing.description.trim()) {
      setError("Description is required");
      return;
    }
    setEditing(null);
    setError(null);
    await saveEditing(editing);
  };

  const handleDelete = async (shotId: string) => {
    if (!confirm("Delete this shot?")) return;
    setDeleting(shotId);
    await deleteShot(shotId);
    setDeleting(null);
    if (editing?.id === shotId) setEditing(null);
    router.refresh();
  };

  // ─── Auto-generate ──────────────────────────────────

  const canAutoGenerate = generationMode !== "off" && shotlistSceneContext.length > 0;

  const handleAutoGenerate = async () => {
    if (!canAutoGenerate) return;
    const profile = SHOTLIST_PROFILES.find((p) => p.id === selectedProfileId) ?? SHOTLIST_PROFILES[0];
    const prompt = buildShotlistPrompt(shotlistSceneContext, profile, `Day ${dayNumber}`);
    setGenerating(true);
    setGenerateError(null);

    try {
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
      if (!data.text) {
        setGenerateError("Empty response from AI");
        setGenerating(false);
        return;
      }

      const importResult = await importShots(data.text, sceneNumberToId);
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

  // ─── Image upload ───────────────────────────────────

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploadingShotId, setUploadingShotId] = React.useState<string | null>(null);

  const handleImageClick = (shotId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // don't trigger row edit
    setUploadingShotId(shotId);
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingShotId) return;
    const fd = new FormData();
    fd.append("file", file);
    await uploadShotImage(uploadingShotId, fd);
    setUploadingShotId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  };

  const handleImageRemove = async (shotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await removeShotImage(shotId);
    router.refresh();
  };

  // ─── Cell renderers ─────────────────────────────────

  function renderCell(col: ColumnDef, shot: ShotData) {
    if (col.key === "image") {
      return shot.storyboardPath ? (
        <div className={cn("relative group/img rounded overflow-hidden bg-muted", IMAGE_SIZES[imageSize].w, IMAGE_SIZES[imageSize].h)}>
          <img
            src={`/api/shot-images/${shot.storyboardPath}`}
            alt={`Shot ${shot.shotNumber}`}
            className="w-full h-full object-contain cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxSrc(`/api/shot-images/${shot.storyboardPath}`);
              setLightboxLabel(`Shot ${shot.shotNumber}`);
            }}
          />
          <button
            type="button"
            onClick={(e) => handleImageRemove(shot.id, e)}
            className="absolute top-0 right-0 rounded-bl bg-black/60 p-0.5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => handleImageClick(shot.id, e)}
          className={cn("flex items-center justify-center rounded border border-dashed border-border/50 text-muted-foreground/40 hover:text-muted-foreground hover:border-border transition-colors", IMAGE_SIZES[imageSize].w, IMAGE_SIZES[imageSize].h)}
          aria-label="Upload storyboard image"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
      );
    }
    const value = shot[col.key as keyof ShotData] as string | null;
    if (col.key === "shotNumber") {
      return (
        <span className="font-mono font-semibold text-xs">
          {value}
        </span>
      );
    }
    if (col.key === "description") {
      return <span className="text-sm leading-snug">{value}</span>;
    }
    return (
      <span className="text-xs text-muted-foreground">{value || "—"}</span>
    );
  }

  function renderEditCell(col: ColumnDef, shot?: ShotData) {
    if (!editing) return null;

    // Image column: show same thumbnail/upload as display mode
    if (col.key === "image") {
      if (!shot) return <div className={cn(IMAGE_SIZES[imageSize].w, IMAGE_SIZES[imageSize].h)} />;
      return renderCell(col, shot);
    }

    const value = editing[col.key as keyof EditingShot] as string;
    const setValue = (v: string) => setEditing((prev) => prev ? { ...prev, [col.key]: v } : prev);

    if (col.type === "select" && col.options) {
      return (
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-full rounded border border-input bg-transparent px-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">—</option>
          {col.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }

    if (col.key === "description") {
      return (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={col.placeholder}
          rows={2}
          className="w-full rounded border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      );
    }

    return (
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={col.placeholder}
        className="h-8 text-xs"
      />
    );
  }

  // ─── Render ─────────────────────────────────────────

  const totalShots = localShots.reduce((s, g) => s + g.shots.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-border">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-tight">
            Shot List — Day {dayNumber}
          </h1>
          <p className="text-xs text-muted-foreground">
            {dateStr}
            {locationName ? ` · ${locationName}` : ""}
            {` · ${scenes.length} scene${scenes.length !== 1 ? "s" : ""}`}
            {` · ${totalShots} shot${totalShots !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Generation controls */}
        {canAutoGenerate ? (
          <>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              disabled={generating}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              aria-label="Shooting profile"
            >
              {SHOTLIST_PROFILES.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <Button size="sm" onClick={handleAutoGenerate} disabled={generating} className="h-8 text-xs">
              {generating ? (
                <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Generating…</>
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
            className="h-8 text-xs"
          >
            {totalShotCount > 0 ? "AI Regenerate" : "AI Generate"}
          </Button>
        )}

        {/* Column toggle */}
        <div className="relative" ref={columnPickerRef}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="h-8 text-xs"
            aria-label="Toggle columns"
          >
            <Columns3 className="mr-1 h-3.5 w-3.5" />
            Columns
          </Button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-background p-3 shadow-lg">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Columns
              </p>
              <div className="space-y-0.5">
                {columnConfig.order.map((key, idx) => {
                  const col = COLUMNS.find((c) => c.key === key);
                  if (!col) return null;
                  const locked = key === "shotNumber" || key === "description";
                  const visible = !columnConfig.hidden.has(key);
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center gap-1.5 rounded px-1.5 py-1 text-sm hover:bg-muted/50",
                        !visible && "opacity-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => toggleColumn(key)}
                        disabled={locked}
                        className="rounded border-input shrink-0"
                      />
                      <span className="flex-1 truncate">{col.label}</span>
                      <button
                        type="button"
                        onClick={() => moveColumn(key, -1)}
                        disabled={idx === 0}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                        aria-label={`Move ${col.label} up`}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(key, 1)}
                        disabled={idx === columnConfig.order.length - 1}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20 disabled:hover:bg-transparent"
                        aria-label={`Move ${col.label} down`}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1.5 border-t border-border/50 pt-2">
                <button
                  type="button"
                  onClick={() => updateConfig(() => getDefaultConfig())}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Reset all
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig((prev) => ({ ...prev, order: ALL_KEYS.slice() }))}
                  className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Reset order
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Image size toggle — only when image column is visible */}
        {!columnConfig.hidden.has("image") && (
          <div className="flex items-center rounded-md border border-input">
            {(Object.keys(IMAGE_SIZES) as ImageSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setImageSize(size);
                  try { localStorage.setItem(IMAGE_SIZE_KEY, size); } catch {}
                }}
                className={cn(
                  "px-2 py-1 text-xs font-medium transition-colors",
                  imageSize === size
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={`Image size ${IMAGE_SIZES[size].label}`}
              >
                {IMAGE_SIZES[size].label}
              </button>
            ))}
          </div>
        )}

        {/* Export */}
        {totalShots > 0 && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportShotlistCSV(localShots, `Day ${dayNumber}`)}
              className="h-8 text-xs"
              aria-label="Export CSV"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => exportShotlistPrint(localShots, `Day ${dayNumber}`)}
              className="h-8 text-xs"
              aria-label="Print"
            >
              <Printer className="mr-1 h-3.5 w-3.5" />
              Print
            </Button>
          </>
        )}
      </div>

      {/* Generation status */}
      {generating && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-4 py-2 text-sm mt-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Generating shot list…</span>
          </div>
        </div>
      )}
      {generateError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm mt-3">
          <p className="font-medium text-destructive">Generation failed</p>
          <p className="text-destructive/80">{generateError}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 mt-3 overflow-x-auto">
        {mounted && (
          <DragDropContext onDragEnd={handleDragEnd}>
            {localShots.map((group) => {
              const isCollapsed = collapsedScenes.has(group.scene.id);
              const meta = [group.scene.intExt, group.scene.dayNight].filter(Boolean).join(" / ");
              return (
                <div key={group.scene.id} className="mb-2">
                  {/* Scene header row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(group.scene.id)}
                      className="flex items-center gap-2 rounded px-2 py-2 text-left hover:bg-muted/50 flex-1 min-w-0"
                      aria-expanded={!isCollapsed}
                    >
                      <ChevronRight
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
                          !isCollapsed && "rotate-90"
                        )}
                      />
                      <span className="font-semibold text-sm">
                        Sc. {group.scene.sceneNumber}
                        {group.scene.title ? ` — ${group.scene.title}` : ""}
                      </span>
                      {meta && (
                        <span className="text-xs text-muted-foreground">{meta}</span>
                      )}
                      <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                        {group.shots.length}
                      </span>
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs shrink-0"
                      onClick={() => handleAdd(group.scene.id)}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add
                    </Button>
                  </div>

                  {!isCollapsed && (
                    <div className="ml-2 border-l-2 border-border/40 pl-2">
                      {/* Column headers */}
                      <div className="flex items-center gap-px px-1 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 border-b border-border/30">
                        <div className="w-8 shrink-0" /> {/* drag handle spacer */}
                        {activeColumns.map((col) => (
                          <div key={col.key} className={cn("px-1.5", colWidth(col))}>
                            {col.shortLabel}
                          </div>
                        ))}
                        <div className="w-16 shrink-0" /> {/* actions spacer */}
                      </div>

                      <Droppable droppableId={group.scene.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "min-h-[32px] transition-colors",
                              snapshot.isDraggingOver && "bg-muted/20"
                            )}
                          >
                            {group.shots.map((shot, index) => (
                              <Draggable key={shot.id} draggableId={shot.id} index={index}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    className={cn(
                                      "group",
                                      dragSnapshot.isDragging && "shadow-lg rounded bg-background ring-1 ring-border"
                                    )}
                                  >
                                    {editing?.id === shot.id ? (
                                      /* Inline edit row — auto-saves on blur */
                                      <div ref={editRowRef} className="flex items-start gap-px px-1 py-1.5 bg-muted/20 border-b border-border/30">
                                        <div {...dragProvided.dragHandleProps} className="w-8 shrink-0" />
                                        {activeColumns.map((col) => (
                                          <div key={col.key} className={cn("px-1", colWidth(col))}>
                                            {renderEditCell(col, shot)}
                                          </div>
                                        ))}
                                        <div className="w-16 shrink-0" />
                                      </div>
                                    ) : (
                                      /* Display row */
                                      <div
                                        className="flex items-center gap-px px-1 py-1.5 border-b border-border/20 hover:bg-muted/30 cursor-pointer"
                                        onClick={() => handleEdit(shot, group.scene.id)}
                                      >
                                        <div
                                          {...dragProvided.dragHandleProps}
                                          className="w-8 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <GripVertical className="h-4 w-4" />
                                        </div>
                                        {activeColumns.map((col) => (
                                          <div key={col.key} className={cn("px-1.5 truncate", colWidth(col))}>
                                            {renderCell(col, shot)}
                                          </div>
                                        ))}
                                        <div
                                          className="flex items-center gap-1 w-16 shrink-0 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => handleDelete(shot.id)}
                                            disabled={deleting === shot.id}
                                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            aria-label={`Delete shot ${shot.shotNumber}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
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

                      {/* New shot inline row */}
                      {editing && !editing.id && editing.sceneId === group.scene.id && (
                        <div ref={editRowRef} className="flex items-start gap-px px-1 py-1.5 bg-muted/20 border-b border-border/30">
                          <div className="w-8 shrink-0" />
                          {activeColumns.map((col) => (
                            <div key={col.key} className={cn("px-1", colWidth(col))}>
                              {renderEditCell(col)}
                            </div>
                          ))}
                          <div className="flex items-center gap-1 w-16 shrink-0 px-1 pt-0.5">
                            <button
                              type="button"
                              onClick={handleSaveNew}
                              disabled={saving}
                              className="rounded p-1 text-green-600 hover:bg-green-500/10"
                              aria-label="Add shot"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {error && editing?.sceneId === group.scene.id && (
                        <p className="px-3 py-1 text-xs text-destructive">{error}</p>
                      )}

                      {group.shots.length === 0 && !(editing && !editing.id && editing.sceneId === group.scene.id) && (
                        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                          No shots yet.
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-2 h-7 text-xs"
                            onClick={() => handleAdd(group.scene.id)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add first shot
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {localShots.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No scenes assigned to this shoot day.
              </div>
            )}
          </DragDropContext>
        )}

        {!mounted && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxSrc}
              alt={lightboxLabel}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <p className="absolute bottom-0 left-0 right-0 text-center text-sm text-white/70 py-2">
              {lightboxLabel}
            </p>
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-3 -right-3 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input for storyboard image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"
        className="hidden"
        onChange={handleImageUpload}
      />

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
