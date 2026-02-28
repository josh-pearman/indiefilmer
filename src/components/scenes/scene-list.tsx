"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { restoreScene } from "@/actions/scenes";
import { runAction } from "@/hooks/use-action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SceneForm, defaultSceneFormValues } from "@/components/scenes/scene-form";
import { SceneExtractDialog } from "@/components/scenes/scene-extract-dialog";
import { ArrowLeft, FileText, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

const TAG_LABELS: Record<string, string> = {
  sound_risk: "🔊",
  permit_risk: "📋",
  stunts: "🤸",
  intimacy: "❗",
  vfx: "✨",
  special_props: "🎭",
  crowd: "👥",
  night_ext: "🌙"
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  sound_risk: "Sound risk",
  permit_risk: "Permit risk",
  stunts: "Stunts",
  intimacy: "Intimacy",
  vfx: "VFX",
  special_props: "Special props",
  crowd: "Crowd",
  night_ext: "Night exterior"
};

const TAGS_LIST = Object.keys(TAG_LABELS) as Array<keyof typeof TAG_LABELS>;

type SceneSortKey = "sceneNumber" | "pageCount" | "location" | "title" | "earliestShootDate";
type SortDir = "asc" | "desc";

const SCENES_SORT_STORAGE_KEY = "indiefilmer-scenes-sort";

const DEFAULT_SCENE_SORT_DIR: Record<SceneSortKey, SortDir> = {
  sceneNumber: "asc",
  pageCount: "desc",
  location: "asc",
  title: "asc",
  earliestShootDate: "asc"
};

type SceneRow = {
  id: string;
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
  pageCount: number | null;
  synopsis: string | null;
  locationId: string | null;
  locationName: string | null;
  isDeleted: boolean;
  shotlistPath: string | null;
  tags: string[];
  earliestShootDate: string | null; // ISO date string or null
  scheduleSummary: string; // "Day 3" | "Days 3, 7" | "Unscheduled"
};

type SceneListProps = {
  scenes: SceneRow[];
  locations: Array<{ id: string; name: string }>;
};

export function SceneList({ scenes: initialScenes, locations }: SceneListProps) {
  const router = useRouter();
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [tagFilter, setTagFilter] = React.useState<string[]>([]);
  const [locationFilter, setLocationFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SceneSortKey>("sceneNumber");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [addOpen, setAddOpen] = React.useState(false);
  const [extractOpen, setExtractOpen] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(SCENES_SORT_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { key: SceneSortKey; dir: SortDir };
        const keys: SceneSortKey[] = ["sceneNumber", "pageCount", "location", "title", "earliestShootDate"];
        if (parsed?.key && keys.includes(parsed.key) && (parsed.dir === "asc" || parsed.dir === "desc")) {
          setSort(parsed.key);
          setSortDir(parsed.dir);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function persistSort(key: SceneSortKey, dir: SortDir) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(SCENES_SORT_STORAGE_KEY, JSON.stringify({ key, dir }));
      }
    } catch {
      // ignore
    }
  }

  function handleSort(key: SceneSortKey) {
    if (key === sort) {
      const nextDir: SortDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(nextDir);
      persistSort(key, nextDir);
    } else {
      const dir = DEFAULT_SCENE_SORT_DIR[key];
      setSort(key);
      setSortDir(dir);
      persistSort(key, dir);
    }
  }

  const filtered = React.useMemo(() => {
    let list = initialScenes.filter((s) => (showDeleted ? true : !s.isDeleted));
    if (tagFilter.length > 0)
      list = list.filter((s) =>
        tagFilter.every((t) => s.tags.includes(t))
      );
    if (locationFilter === "unassigned")
      list = list.filter((s) => !s.locationId);
    else if (locationFilter !== "all")
      list = list.filter((s) => s.locationId === locationFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.sceneNumber.toLowerCase().includes(q) ||
          (s.title?.toLowerCase().includes(q) ?? false) ||
          (s.synopsis?.toLowerCase().includes(q) ?? false)
      );
    }
    const mult = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      if (sort === "sceneNumber")
        return mult * a.sceneNumber.localeCompare(b.sceneNumber, undefined, { numeric: true });
      if (sort === "pageCount") {
        const ap = a.pageCount ?? 0;
        const bp = b.pageCount ?? 0;
        return mult * (ap - bp);
      }
      if (sort === "location") {
        const an = a.locationName ?? "";
        const bn = b.locationName ?? "";
        return mult * an.localeCompare(bn);
      }
      if (sort === "title") {
        const an = a.title ?? "";
        const bn = b.title ?? "";
        return mult * an.localeCompare(bn);
      }
      if (sort === "earliestShootDate") {
        const ad = a.earliestShootDate ?? "";
        const bd = b.earliestShootDate ?? "";
        return mult * ad.localeCompare(bd);
      }
      return 0;
    });
    return sorted;
  }, [
    initialScenes,
    showDeleted,
    tagFilter,
    locationFilter,
    search,
    sort,
    sortDir
  ]);

  const summary = React.useMemo(() => {
    const totalScenes = filtered.length;
    const totalPages = filtered.reduce(
      (sum, s) => sum + (s.pageCount ?? 0),
      0
    );
    const unassignedCount = filtered.filter((s) => !s.locationId).length;
    const unscheduledCount = filtered.filter(
      (s) => !s.earliestShootDate
    ).length;
    return { totalScenes, totalPages, unassignedCount, unscheduledCount };
  }, [filtered]);

  async function handleRestore(id: string) {
    setRestoringId(id);
    await runAction(() => restoreScene(id), "Restore scene failed");
    setRestoringId(null);
    router.refresh();
  }

  function toggleTag(tag: string) {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (locationFilter !== "all") count++;
    if (tagFilter.length > 0) count++;
    if (showDeleted) count++;
    return count;
  }, [locationFilter, tagFilter, showDeleted]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Search scene #, title, synopsis..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex h-9 max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1 text-sm md:hidden"
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className={cn("flex flex-wrap items-center gap-2", !filtersOpen && "hidden md:flex")}>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="all">All locations</option>
            <option value="unassigned">Unassigned</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-border"
            />
            Show deleted
          </label>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExtractOpen(true)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Extract from Script
            </Button>
            {initialScenes.filter((s) => !s.isDeleted).length === 0 && (
              <span className="ml-2 flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                <ArrowLeft className="h-3 w-3" />
                Recommended
              </span>
            )}
          </div>
          <SceneExtractDialog open={extractOpen} onOpenChange={setExtractOpen} />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <Button type="button" onClick={() => setAddOpen(true)}>Add Manually</Button>
            <DialogContent>
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Add Scene</h2>
                <SceneForm
                  mode="create"
                  defaultValues={defaultSceneFormValues}
                  locations={locations}
                  onSuccess={() => setAddOpen(false)}
                  onCancel={() => setAddOpen(false)}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Tag legend</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {TAGS_LIST.map((tag) => (
            <span key={tag}>
              {TAG_LABELS[tag]} {TAG_DESCRIPTIONS[tag]}
            </span>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scenes</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showDeleted
                ? "No scenes match the filters."
                : "No scenes yet. Add one to get started."}
            </p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 md:hidden">
                {filtered.map((scene) => (
                  <Link
                    key={scene.id}
                    href={`/script/scenes/${scene.id}`}
                    className={cn(
                      "block rounded-lg border border-border/60 p-3 hover:bg-accent/50 transition-colors",
                      scene.isDeleted && "opacity-70"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn("font-medium", scene.isDeleted && "line-through")}>
                          <span className="text-primary">{scene.sceneNumber}</span>
                          {scene.title && <span className="ml-2">{scene.title}</span>}
                        </p>
                        {scene.locationName && (
                          <p className="text-sm text-muted-foreground truncate">{scene.locationName}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {scene.intExt && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{scene.intExt}</span>
                        )}
                        {scene.dayNight && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{scene.dayNight}</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      {scene.pageCount != null && <span>{scene.pageCount} pg</span>}
                      {scene.tags.length > 0 && (
                        <span>{scene.tags.map((t) => TAG_LABELS[t] ?? t).join(" ")}</span>
                      )}
                      <span className={scene.scheduleSummary === "Unscheduled" ? "text-muted-foreground" : ""}>
                        {scene.scheduleSummary}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("sceneNumber")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Scene #
                          {sort === "sceneNumber" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 w-8"></th>
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("title")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Title
                          {sort === "title" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-left font-medium">INT/EXT</th>
                      <th className="pb-2 text-left font-medium">DAY/NIGHT</th>
                      <th className="pb-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("pageCount")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline ml-auto"
                        >
                          Pages
                          {sort === "pageCount" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("location")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Location
                          {sort === "location" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-left font-medium">Tags</th>
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("earliestShootDate")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Shoot day
                          {sort === "earliestShootDate" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      {showDeleted && <th className="pb-2 text-right font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((scene) => (
                      <tr
                        key={scene.id}
                        className={cn(
                          "border-b border-border/60 last:border-0",
                          scene.isDeleted && "opacity-70"
                        )}
                      >
                        <td className="py-2">
                          <Link
                            href={`/script/scenes/${scene.id}`}
                            className={cn(
                              "text-primary hover:underline font-medium",
                              scene.isDeleted && "line-through"
                            )}
                          >
                            {scene.sceneNumber}
                          </Link>
                        </td>
                        <td className="py-2 w-8">
                          {scene.shotlistPath ? (
                            <span title="Shotlist attached" className="text-muted-foreground">
                              <Paperclip className="h-4 w-4" />
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 max-w-[120px] truncate">
                          <Link
                            href={`/script/scenes/${scene.id}`}
                            className="text-primary hover:underline"
                          >
                            {scene.title ?? "—"}
                          </Link>
                        </td>
                        <td className="py-2">
                          {scene.intExt ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {scene.intExt}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2">
                          {scene.dayNight ? (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                              {scene.dayNight}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {scene.pageCount != null ? scene.pageCount : "—"}
                        </td>
                        <td className="py-2">
                          {scene.locationId ? (
                            <Link
                              href={`/production/locations/${scene.locationId}`}
                              className="text-primary hover:underline"
                            >
                              {scene.locationName ?? "—"}
                            </Link>
                          ) : (
                            "Unassigned"
                          )}
                        </td>
                        <td className="py-2">
                          {scene.tags.length
                            ? scene.tags.map((t) => TAG_LABELS[t] ?? t).join(" ")
                            : "—"}
                        </td>
                        <td className="py-2">
                          <span className={scene.scheduleSummary === "Unscheduled" ? "text-muted-foreground" : ""}>
                            {scene.scheduleSummary}
                          </span>
                        </td>
                        {showDeleted && (
                          <td className="py-2 text-right">
                            {scene.isDeleted && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestore(scene.id)}
                                disabled={restoringId === scene.id}
                              >
                                {restoringId === scene.id ? "Restoring..." : "Restore"}
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4 text-sm">
              <span>Total scenes: {summary.totalScenes}</span>
              <span>Total pages: {summary.totalPages.toFixed(1)}</span>
              <span>Unassigned to location: {summary.unassignedCount}</span>
              <span>Unscheduled: {summary.unscheduledCount}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
