"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { LineItemRow, type LineItemRowData } from "./line-item-row";
import { LineItemForm, type SourceOption } from "./line-item-form";
import { LineItemsTotals } from "./line-items-totals";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortKey = "date" | "actual" | "bucket";

type LineItemsListProps = {
  items: LineItemRowData[];
  buckets: Array<{ id: string; name: string }>;
  sourceOptions?: SourceOption[];
};

export function LineItemsList({
  items: initialItems,
  buckets,
  sourceOptions = []
}: LineItemsListProps) {
  const searchParams = useSearchParams();
  const bucketParam = searchParams.get("bucket") ?? "";

  const [bucketFilter, setBucketFilter] = React.useState(() => {
    const name = bucketParam;
    if (!name) return "all";
    const b = buckets.find(
      (x) => x.name.toLowerCase() === name.toLowerCase()
    );
    return b ? b.id : "all";
  });
  const [search, setSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [showDeleted, setShowDeleted] = React.useState(false);
  const [sort, setSort] = React.useState<SortKey>("date");

  // Sync bucket filter from URL when bucket param is present
  React.useEffect(() => {
    if (!bucketParam) return;
    const b = buckets.find(
      (x) => x.name.toLowerCase() === bucketParam.toLowerCase()
    );
    if (b) setBucketFilter(b.id);
  }, [bucketParam, buckets]);

  const filtered = React.useMemo(() => {
    let list = initialItems.filter(
      (i) => showDeleted || !i.isDeleted
    );
    if (bucketFilter !== "all") {
      list = list.filter((i) => i.bucketId === bucketFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          (i.notes?.toLowerCase().includes(q) ?? false)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((i) => i.date && new Date(i.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((i) => i.date && new Date(i.date) <= to);
    }
    const sorted = [...list].sort((a, b) => {
      if (sort === "date") {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      }
      if (sort === "actual") {
        return b.actualAmount - a.actualAmount;
      }
      if (sort === "bucket") {
        return a.bucketName.localeCompare(b.bucketName);
      }
      return 0;
    });
    return sorted;
  }, [
    initialItems,
    showDeleted,
    bucketFilter,
    search,
    dateFrom,
    dateTo,
    sort
  ]);

  const totals = React.useMemo(() => {
    const planned = filtered
      .filter((i) => !i.isDeleted)
      .reduce((s, i) => s + (i.plannedAmount ?? 0), 0);
    const actual = filtered
      .filter((i) => !i.isDeleted)
      .reduce((s, i) => s + i.actualAmount, 0);
    return { planned, actual };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <LineItemForm
          buckets={buckets}
          sourceOptions={sourceOptions}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={bucketFilter}
          onChange={(e) => setBucketFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="all">All Buckets</option>
          {buckets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <Input
          type="text"
          placeholder="Search description, notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-[200px]"
        />
        <Input
          type="date"
          placeholder="From"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 w-[130px]"
        />
        <Input
          type="date"
          placeholder="To"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 w-[130px]"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="date">Date (newest first)</option>
          <option value="actual">Actual amount</option>
          <option value="bucket">Bucket</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            className="rounded border-input"
          />
          Show deleted
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="pb-2 pr-4 text-left font-medium">Date</th>
              <th className="pb-2 pr-4 text-left font-medium">Bucket</th>
              <th className="pb-2 pr-4 text-left font-medium">Description</th>
              <th className="pb-2 pr-4 text-right font-medium">Planned</th>
              <th className="pb-2 pr-4 text-right font-medium">Actual</th>
              <th className="pb-2 pr-4 text-left font-medium">Notes</th>
              <th className="pb-2 text-left font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No line items match the filters. Add one to get started.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  buckets={buckets}
                />
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 0 && (
          <div className="border-t border-border px-4 pb-3 pt-2">
            <LineItemsTotals
              count={filtered.filter((i) => !i.isDeleted).length}
              totalPlanned={totals.planned}
              totalActual={totals.actual}
            />
          </div>
        )}
      </div>
    </div>
  );
}
