"use client";

import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DietaryEntry } from "./craft-services-grid";

type DietaryRestrictionsDialogProps = {
  dayLabel: string;
  entries: DietaryEntry[];
};

/**
 * Groups entries by normalized restriction term, returning
 * { label, names[] } sorted by count descending.
 */
function groupByRestriction(entries: DietaryEntry[]) {
  const map = new Map<string, { label: string; names: string[] }>();
  for (const entry of entries) {
    const parts = entry.restrictions.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const key = part.toLowerCase();
      const existing = map.get(key);
      if (existing) {
        existing.names.push(entry.name);
      } else {
        map.set(key, { label: part, names: [entry.name] });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.names.length - a.names.length);
}

export function DietaryRestrictionsDialog({
  dayLabel,
  entries,
}: DietaryRestrictionsDialogProps) {
  const grouped = groupByRestriction(entries);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-primary hover:underline focus:outline-none"
        >
          View Dietary
        </button>
      </DialogTrigger>
      <DialogContent hideTitle={false}>
        <DialogTitle>{dayLabel} — Dietary Restrictions</DialogTitle>
        <div className="mt-4 space-y-4">
          {grouped.map(({ label, names }) => (
            <div key={label}>
              <div className="text-sm font-medium">
                {label}
                <span className="ml-1 text-muted-foreground font-normal">
                  ({names.length})
                </span>
              </div>
              <ul className="mt-1 space-y-0.5 pl-4 text-sm text-muted-foreground">
                {names.map((name, i) => (
                  <li key={i} className="list-disc">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
