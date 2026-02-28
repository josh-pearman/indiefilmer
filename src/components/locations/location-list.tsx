"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { restoreLocation, deleteLocation } from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LocationForm, defaultLocationFormValues } from "@/components/locations/location-form";
import { cn } from "@/lib/utils";

const STATUSES = ["Shortlist", "Contacted", "Visited", "On Hold", "Booked", "Rejected"] as const;
const PROVIDERS = ["Peerspace", "Giggster", "Other"] as const;
type SortKey = "name" | "status" | "estimatedTotal" | "linkedScenes";
type SortDir = "asc" | "desc";

const LOCATIONS_SORT_STORAGE_KEY = "indiefilmer-locations-sort";

const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  name: "asc",
  status: "asc",
  estimatedTotal: "desc",
  linkedScenes: "desc"
};

type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  providerType: string | null;
  status: string;
  estimatedCostPerDay: number | null;
  numberOfDays: number | null;
  fees: number | null;
  budgetBucket: string | null;
  isDeleted: boolean;
  _count: { scenes: number };
};

function estimatedTotal(loc: LocationRow): number | null {
  const perDay = loc.estimatedCostPerDay ?? 0;
  const days = loc.numberOfDays ?? 0;
  const f = loc.fees ?? 0;
  if (perDay > 0 && days > 0) return perDay * days + f;
  if (f > 0) return f;
  return null;
}

type LocationListProps = {
  locations: LocationRow[];
  autocompleteEnabled?: boolean;
  currencySymbol?: string;
};

export function LocationList({ locations: initialLocations, autocompleteEnabled = false, currencySymbol = "$" }: LocationListProps) {
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [providerFilter, setProviderFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("linkedScenes");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [addOpen, setAddOpen] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(LOCATIONS_SORT_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { key: SortKey; dir: SortDir };
        if (typeof parsed?.key === "string" && (parsed.key === "name" || parsed.key === "status" || parsed.key === "estimatedTotal" || parsed.key === "linkedScenes") && (parsed.dir === "asc" || parsed.dir === "desc")) {
          setSort(parsed.key);
          setSortDir(parsed.dir);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function persistSort(key: SortKey, dir: SortDir) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCATIONS_SORT_STORAGE_KEY, JSON.stringify({ key, dir }));
      }
    } catch {
      // ignore
    }
  }

  function handleSort(key: SortKey) {
    if (key === sort) {
      const nextDir: SortDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(nextDir);
      persistSort(key, nextDir);
    } else {
      const dir = DEFAULT_SORT_DIR[key];
      setSort(key);
      setSortDir(dir);
      persistSort(key, dir);
    }
  }

  const filtered = React.useMemo(() => {
    let list = initialLocations.filter((loc) =>
      showDeleted ? true : !loc.isDeleted
    );
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    if (providerFilter !== "all")
      list = list.filter((l) => l.providerType === providerFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.address?.toLowerCase().includes(q) ?? false)
      );
    }
    const withTotal = list.map((loc) => ({
      ...loc,
      _estimatedTotal: estimatedTotal(loc)
    }));
    const mult = sortDir === "asc" ? 1 : -1;
    withTotal.sort((a, b) => {
      if (sort === "name") return mult * a.name.localeCompare(b.name);
      if (sort === "status") return mult * a.status.localeCompare(b.status);
      if (sort === "estimatedTotal") {
        const at = a._estimatedTotal ?? 0;
        const bt = b._estimatedTotal ?? 0;
        return mult * (at - bt);
      }
      if (sort === "linkedScenes") {
        return mult * ((a._count?.scenes ?? 0) - (b._count?.scenes ?? 0));
      }
      return 0;
    });
    return withTotal;
  }, [
    initialLocations,
    showDeleted,
    statusFilter,
    providerFilter,
    search,
    sort,
    sortDir
  ]);

  const totalEstimated = React.useMemo(
    () =>
      filtered.reduce((sum, loc) => {
        const t = estimatedTotal(loc);
        return sum + (t ?? 0);
      }, 0),
    [filtered]
  );

  async function handleRestore(id: string) {
    setRestoringId(id);
    await restoreLocation(id);
    setRestoringId(null);
    router.refresh();
  }

  const selectableIds = React.useMemo(
    () => filtered.filter((loc) => !loc.isDeleted).map((loc) => loc.id),
    [filtered]
  );
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableIds));
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds).filter((id) =>
      selectableIds.includes(id)
    );
    if (ids.length === 0) return;
    setDeleting(true);
    for (const id of ids) await deleteLocation(id);
    setSelectedIds(new Set());
    setDeleting(false);
    router.refresh();
  }

  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (providerFilter !== "all") count++;
    if (sort !== "linkedScenes") count++;
    if (showDeleted) count++;
    return count;
  }, [statusFilter, providerFilter, sort, showDeleted]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search name or address..."
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="all">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="all">All providers</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => {
                const key = e.target.value as SortKey;
                const dir = DEFAULT_SORT_DIR[key];
                setSort(key);
                setSortDir(dir);
                persistSort(key, dir);
              }}
              className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="linkedScenes">Sort by linked scenes</option>
              <option value="name">Sort by name</option>
              <option value="status">Sort by status</option>
              <option value="estimatedTotal">Sort by estimated cost</option>
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
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : `Delete selected (${selectedIds.size})`}
            </Button>
          )}
          <Button type="button" onClick={() => setAddOpen(true)}>Add Location</Button>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Add Location</h2>
              <LocationForm
                mode="create"
                defaultValues={defaultLocationFormValues}
                autocompleteEnabled={autocompleteEnabled}
                onSuccess={() => setAddOpen(false)}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showDeleted
                ? "No locations match the filters."
                : "No locations yet. Add one to get started."}
            </p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 md:hidden">
                {filtered.map((loc) => {
                  const total = estimatedTotal(loc);
                  return (
                    <Link
                      key={loc.id}
                      href={`/production/locations/${loc.id}`}
                      className={cn(
                        "block rounded-lg border border-border/60 p-3 hover:bg-accent/50 transition-colors",
                        loc.isDeleted && "opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn("font-medium truncate", loc.isDeleted && "line-through")}>
                          {loc.name}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                            loc.status === "Booked" && "bg-green-500/20 text-green-700",
                            loc.status === "Rejected" && "bg-destructive/20 text-destructive",
                            !["Booked", "Rejected"].includes(loc.status) && "bg-muted text-muted-foreground"
                          )}
                        >
                          {loc.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        {loc.providerType && <span>{loc.providerType}</span>}
                        <span>{loc._count.scenes} scene{loc._count.scenes === 1 ? "" : "s"}</span>
                        {total != null && <span>{currencySymbol}{total.toFixed(0)}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="w-10 pb-2 pr-2 text-left">
                        {selectableIds.length > 0 && (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={toggleSelectAll}
                            className="rounded border-border"
                            aria-label="Select all"
                          />
                        )}
                      </th>
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Name
                          {sort === "name" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("status")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Status
                          {sort === "status" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-left font-medium">Provider</th>
                      <th className="pb-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("estimatedTotal")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline ml-auto"
                        >
                          Est. total cost
                          {sort === "estimatedTotal" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("linkedScenes")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline ml-auto"
                        >
                          Linked scenes
                          {sort === "linkedScenes" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((loc) => {
                      const total = estimatedTotal(loc);
                      return (
                        <tr
                          key={loc.id}
                          className={cn(
                            "border-b border-border/60 last:border-0",
                            loc.isDeleted && "opacity-70"
                          )}
                        >
                          <td className="w-10 py-2 pr-2">
                            {!loc.isDeleted && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(loc.id)}
                                onChange={() => toggleSelect(loc.id)}
                                className="rounded border-border"
                                aria-label={`Select ${loc.name}`}
                              />
                            )}
                          </td>
                          <td className="py-2">
                            <Link
                              href={`/production/locations/${loc.id}`}
                              className={cn(
                                "text-primary hover:underline",
                                loc.isDeleted && "line-through"
                              )}
                            >
                              {loc.name}
                            </Link>
                          </td>
                          <td className="py-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs font-medium",
                                loc.status === "Booked" &&
                                  "bg-green-500/20 text-green-700",
                                loc.status === "Rejected" &&
                                  "bg-destructive/20 text-destructive",
                                !["Booked", "Rejected"].includes(loc.status) &&
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {loc.status}
                            </span>
                          </td>
                          <td className="py-2">{loc.providerType ?? "—"}</td>
                          <td className="py-2 text-right">
                            {total != null ? `${currencySymbol}${total.toFixed(0)}` : "—"}
                          </td>
                          <td className="py-2 text-right">{loc._count.scenes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {filtered.length > 0 && (
            <p className="mt-4 border-t border-border pt-4 text-sm font-medium">
              Total estimated cost (filtered): {currencySymbol}
              {totalEstimated.toFixed(0)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
