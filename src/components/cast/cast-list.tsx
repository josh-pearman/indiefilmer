"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { restoreCastMember, deleteCastMember } from "@/actions/cast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CastForm, defaultCastFormValues } from "@/components/cast/cast-form";
import { CreditsExportDialog } from "@/components/cast/credits-export-dialog";
import { IntakeEmailButton } from "@/components/shared/intake-email-button";
import { IntakeTemplateEditor } from "@/components/shared/intake-template-editor";
import { cn } from "@/lib/utils";

const STATUSES = ["Confirmed", "Pending", "Backup", "TBD"] as const;
type SortKey = "sceneCount" | "name" | "actorName" | "status" | "estimatedCost";
type SortDir = "asc" | "desc";

const CAST_SORT_STORAGE_KEY = "indiefilmer-cast-sort";

const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  sceneCount: "desc",
  name: "asc",
  actorName: "asc",
  status: "asc",
  estimatedCost: "desc"
};

type CastRow = {
  id: string;
  name: string;
  roleName: string | null;
  actorName: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  rate: number | null;
  days: number | null;
  flatFee: number | null;
  budgetBucket: string | null;
  intakeToken: string | null;
  isDeleted: boolean;
  sceneCount: number;
};

function estimatedCost(c: CastRow): number | null {
  if (c.flatFee != null && c.flatFee > 0) return c.flatFee;
  if (c.rate != null && c.days != null && c.rate > 0 && c.days > 0)
    return c.rate * c.days;
  return null;
}

type CastListProps = {
  cast: CastRow[];
  projectName: string;
  emailEnabled?: boolean;
};

export function CastList({ cast: initialCast, projectName, emailEnabled = false }: CastListProps) {
  const router = useRouter();
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("sceneCount");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [addOpen, setAddOpen] = React.useState(false);
  const [restoringId, setRestoringId] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(CAST_SORT_STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as { key: SortKey; dir: SortDir };
        const keys: SortKey[] = ["sceneCount", "name", "actorName", "status", "estimatedCost"];
        if (parsed?.key && keys.includes(parsed.key) && (parsed.dir === "asc" || parsed.dir === "desc")) {
          setSort(parsed.key);
          setSortDir(parsed.dir);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [router]);

  function persistSort(key: SortKey, dir: SortDir) {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(CAST_SORT_STORAGE_KEY, JSON.stringify({ key, dir }));
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
    let list = initialCast.filter((c) => (showDeleted ? true : !c.isDeleted));
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.roleName?.toLowerCase().includes(q) ?? false) ||
          (c.actorName?.toLowerCase().includes(q) ?? false) ||
          (c.notes?.toLowerCase().includes(q) ?? false)
      );
    }
    const mult = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      if (sort === "sceneCount") return mult * (a.sceneCount - b.sceneCount);
      if (sort === "name") return mult * a.name.localeCompare(b.name);
      if (sort === "actorName") {
        const an = a.actorName?.trim() ?? "";
        const bn = b.actorName?.trim() ?? "";
        return mult * an.localeCompare(bn);
      }
      if (sort === "status") return mult * a.status.localeCompare(b.status);
      if (sort === "estimatedCost") {
        const ac = estimatedCost(a) ?? 0;
        const bc = estimatedCost(b) ?? 0;
        return mult * (ac - bc);
      }
      return 0;
    });
    return sorted;
  }, [
    initialCast,
    showDeleted,
    statusFilter,
    search,
    sort,
    sortDir
  ]);

  const summary = React.useMemo(() => {
    const totalCast = filtered.length;
    const confirmedCount = filtered.filter((c) => c.status === "Confirmed").length;
    const totalCost = filtered.reduce(
      (sum, c) => sum + (estimatedCost(c) ?? 0),
      0
    );
    return { totalCast, confirmedCount, totalCost };
  }, [filtered]);

  async function handleRestore(id: string) {
    setRestoringId(id);
    await restoreCastMember(id);
    setRestoringId(null);
    router.refresh();
  }

  const selectableIds = React.useMemo(
    () => filtered.filter((c) => !c.isDeleted).map((c) => c.id),
    [filtered]
  );
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

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
    for (const id of ids) await deleteCastMember(id);
    setSelectedIds(new Set());
    setDeleting(false);
    router.refresh();
  }

  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (sort !== "sceneCount") count++;
    if (showDeleted) count++;
    return count;
  }, [statusFilter, sort, showDeleted]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search role, role description, actor..."
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
              <option value="sceneCount">Sort by scene count</option>
              <option value="name">Sort by role</option>
              <option value="actorName">Sort by actor</option>
              <option value="status">Sort by status</option>
              <option value="estimatedCost">Sort by estimated cost</option>
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
          <IntakeTemplateEditor />
          <CreditsExportDialog />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <Button type="button" onClick={() => setAddOpen(true)}>Add Cast Member</Button>
          <DialogContent>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Add Cast Member</h2>
              <CastForm
                mode="create"
                defaultValues={defaultCastFormValues}
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
          <CardTitle>Cast</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showDeleted
                ? "No cast members match the filters."
                : "No cast members yet. Add one to get started."}
            </p>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="space-y-3 md:hidden">
                {filtered.map((c) => {
                  const cost = estimatedCost(c);
                  return (
                    <Link
                      key={c.id}
                      href={`/talent/cast/${c.id}`}
                      className={cn(
                        "block rounded-lg border border-border/60 p-3 hover:bg-accent/50 transition-colors",
                        c.isDeleted && "opacity-70"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn("font-medium truncate", c.isDeleted && "line-through", !c.name && "text-muted-foreground")}>
                            {c.name || "—"}
                          </p>
                          {c.actorName?.trim() && (
                            <p className="text-sm text-muted-foreground truncate">{c.actorName}</p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                            c.status === "Confirmed" && "bg-green-500/20 text-green-700",
                            c.status === "Pending" && "bg-yellow-500/20 text-yellow-700",
                            c.status === "Backup" && "bg-blue-500/20 text-blue-700",
                            c.status === "TBD" && "bg-muted text-muted-foreground"
                          )}
                        >
                          {c.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{c.sceneCount} scene{c.sceneCount === 1 ? "" : "s"}</span>
                        {cost != null && <span>${cost.toFixed(0)}</span>}
                        {!c.isDeleted && (
                          <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                            <IntakeEmailButton
                              type="cast"
                              id={c.id}
                              name={c.actorName?.trim() || c.name}
                              email={c.email}
                              intakeToken={c.intakeToken}
                              projectName={projectName}
                              emailEnabled={emailEnabled}
                            />
                          </div>
                        )}
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
                          Role
                          {sort === "name" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-left font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("actorName")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline"
                        >
                          Actor/Actress
                          {sort === "actorName" && (sortDir === "asc" ? " ↑" : " ↓")}
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
                      <th className="pb-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("sceneCount")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline ml-auto"
                        >
                          Scenes
                          {sort === "sceneCount" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-right font-medium">
                        <button
                          type="button"
                          onClick={() => handleSort("estimatedCost")}
                          className="inline-flex items-center gap-1 hover:text-foreground focus:outline-none focus:underline ml-auto"
                        >
                          Est. cost
                          {sort === "estimatedCost" && (sortDir === "asc" ? " ↑" : " ↓")}
                        </button>
                      </th>
                      <th className="pb-2 text-right font-medium">Intake</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const cost = estimatedCost(c);
                      return (
                        <tr
                          key={c.id}
                          className={cn(
                            "border-b border-border/60 last:border-0",
                            c.isDeleted && "opacity-70"
                          )}
                        >
                          <td className="w-10 py-2 pr-2">
                            {!c.isDeleted && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={() => toggleSelect(c.id)}
                                className="rounded border-border"
                                aria-label={`Select ${c.name}`}
                              />
                            )}
                          </td>
                          <td className="py-2">
                            <Link
                              href={`/talent/cast/${c.id}`}
                              className={cn(
                                "text-primary hover:underline font-medium",
                                c.isDeleted && "line-through",
                                !c.name && "text-muted-foreground"
                              )}
                            >
                              {c.name || "—"}
                            </Link>
                            {c.roleName && (
                              <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={c.roleName}>
                                {c.roleName}
                              </p>
                            )}
                          </td>
                          <td className="py-2">{c.actorName?.trim() ? c.actorName : "—"}</td>
                          <td className="py-2">
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-xs font-medium",
                                c.status === "Confirmed" &&
                                  "bg-green-500/20 text-green-700",
                                c.status === "Pending" &&
                                  "bg-yellow-500/20 text-yellow-700",
                                c.status === "Backup" &&
                                  "bg-blue-500/20 text-blue-700",
                                c.status === "TBD" &&
                                  "bg-muted text-muted-foreground"
                              )}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            <span className="text-muted-foreground" title={`${c.sceneCount} scene${c.sceneCount === 1 ? "" : "s"}`}>
                              {c.sceneCount} scene{c.sceneCount === 1 ? "" : "s"}
                            </span>
                          </td>
                          <td className="py-2 text-right">
                            {cost != null ? `$${cost.toFixed(0)}` : "—"}
                          </td>
                          <td className="py-2 text-right">
                            {!c.isDeleted && (
                              <IntakeEmailButton
                                type="cast"
                                id={c.id}
                                name={c.actorName?.trim() || c.name}
                                email={c.email}
                                intakeToken={c.intakeToken}
                                projectName={projectName}
                                emailEnabled={emailEnabled}
                              />
                            )}
                            {c.isDeleted && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleRestore(c.id)}
                                disabled={restoringId === c.id}
                              >
                                {restoringId === c.id ? "Restoring..." : "Restore"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {filtered.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-6 border-t border-border pt-4 text-sm">
              <span>Total cast: {summary.totalCast}</span>
              <span>Confirmed: {summary.confirmedCount}</span>
              <span>Total estimated cost: ${summary.totalCost.toFixed(0)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
