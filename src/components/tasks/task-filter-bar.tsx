"use client";

import * as React from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PRIORITY_CONFIG } from "./task-priority-icon";

const CATEGORY_OPTIONS = [
  { value: "camera", label: "Camera" },
  { value: "sound", label: "Sound" },
  { value: "art", label: "Art" },
  { value: "locations", label: "Locations" },
  { value: "permits", label: "Permits" },
  { value: "post", label: "Post" },
  { value: "general", label: "General" }
];

const DUE_DATE_OPTIONS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due Today" },
  { value: "week", label: "This Week" },
  { value: "none", label: "No Date" }
];

export type TaskFilters = {
  search: string;
  owners: string[];
  priorities: string[];
  dueDateFilter: string;
  categories: string[];
};

export const emptyFilters: TaskFilters = {
  search: "",
  owners: [],
  priorities: [],
  dueDateFilter: "",
  categories: []
};

type TaskFilterBarProps = {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  ownerOptions: Array<{ value: string; label: string }>;
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search !== "" ||
    filters.owners.length > 0 ||
    filters.priorities.length > 0 ||
    filters.dueDateFilter !== "" ||
    filters.categories.length > 0
  );
}

export function TaskFilterBar({ filters, onChange, ownerOptions }: TaskFilterBarProps) {
  const [expanded, setExpanded] = React.useState(false);
  const active = hasActiveFilters(filters);
  const activeCount = [
    filters.search ? 1 : 0,
    filters.owners.length > 0 ? 1 : 0,
    filters.priorities.length > 0 ? 1 : 0,
    filters.dueDateFilter ? 1 : 0,
    filters.categories.length > 0 ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search tasks..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, search: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <Button
          type="button"
          variant={active ? "default" : "outline"}
          size="sm"
          onClick={() => setExpanded((o) => !o)}
          className="gap-1.5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-background/20 px-1.5 text-[11px] tabular-nums">{activeCount}</span>
          )}
        </Button>

        {active && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyFilters)}
            className="text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Expanded filter row */}
      {expanded && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/20 p-3">
          {/* Owner filter */}
          <FilterSelect
            label="Assignee"
            value={filters.owners}
            onChange={(owners) => onChange({ ...filters, owners })}
            options={ownerOptions.filter((o) => o.value).map((o) => ({ value: o.value, label: o.label }))}
            multi
          />

          {/* Priority filter */}
          <FilterSelect
            label="Priority"
            value={filters.priorities}
            onChange={(priorities) => onChange({ ...filters, priorities })}
            options={Object.entries(PRIORITY_CONFIG)
              .filter(([k]) => k !== "none")
              .map(([k, v]) => ({ value: k, label: v.label }))}
            multi
          />

          {/* Due date filter */}
          <FilterSelect
            label="Due"
            value={filters.dueDateFilter ? [filters.dueDateFilter] : []}
            onChange={(vals) => onChange({ ...filters, dueDateFilter: vals[0] ?? "" })}
            options={DUE_DATE_OPTIONS}
          />

          {/* Category filter */}
          <FilterSelect
            label="Category"
            value={filters.categories}
            onChange={(categories) => onChange({ ...filters, categories })}
            options={CATEGORY_OPTIONS}
            multi
          />
        </div>
      )}

      {/* Active filter pills */}
      {active && !expanded && (
        <div className="flex flex-wrap gap-1.5">
          {filters.owners.map((owner) => {
            const label = ownerOptions.find((o) => o.value === owner)?.label ?? owner;
            return (
              <FilterPill
                key={`owner-${owner}`}
                label={label}
                onRemove={() => onChange({ ...filters, owners: filters.owners.filter((o) => o !== owner) })}
              />
            );
          })}
          {filters.priorities.map((p) => (
            <FilterPill
              key={`priority-${p}`}
              label={PRIORITY_CONFIG[p]?.label ?? p}
              onRemove={() => onChange({ ...filters, priorities: filters.priorities.filter((x) => x !== p) })}
            />
          ))}
          {filters.dueDateFilter && (
            <FilterPill
              label={DUE_DATE_OPTIONS.find((o) => o.value === filters.dueDateFilter)?.label ?? filters.dueDateFilter}
              onRemove={() => onChange({ ...filters, dueDateFilter: "" })}
            />
          )}
          {filters.categories.map((c) => (
            <FilterPill
              key={`cat-${c}`}
              label={CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c}
              onRemove={() => onChange({ ...filters, categories: filters.categories.filter((x) => x !== c) })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────── */

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
      {label}
      <button type="button" onClick={onRemove} className="hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  multi = false
}: {
  label: string;
  value: string[];
  onChange: (val: string[]) => void;
  options: Array<{ value: string; label: string }>;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (multi) {
                  onChange(selected ? value.filter((v) => v !== opt.value) : [...value, opt.value]);
                } else {
                  onChange(selected ? [] : [opt.value]);
                }
              }}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
