"use client";

import * as React from "react";
import Link from "next/link";
import { cn, localDate } from "@/lib/utils";

export type SceneChecklistItem = {
  id: string;
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
  pageCount: number | null;
};

export type ScheduleDayBadge = {
  id: string;
  date: string;
  dayNumber: number;
};

type SceneChecklistProps = {
  scenes: SceneChecklistItem[];
  checkedIds: string[];
  onCheckedChange: (checkedIds: string[]) => void;
  scheduleStatus?: Record<string, ScheduleDayBadge[]>;
  showTotalPages?: boolean;
  disabled?: boolean;
};

export function SceneChecklist({
  scenes,
  checkedIds,
  onCheckedChange,
  scheduleStatus = {},
  showTotalPages = true,
  disabled = false
}: SceneChecklistProps) {
  const toggle = (sceneId: string) => {
    if (disabled) return;
    if (checkedIds.includes(sceneId)) {
      onCheckedChange(checkedIds.filter((id) => id !== sceneId));
    } else {
      onCheckedChange([...checkedIds, sceneId].sort((a, b) => {
        const sa = scenes.find((s) => s.id === a);
        const sb = scenes.find((s) => s.id === b);
        if (!sa || !sb) return 0;
        return (sa.sceneNumber || "").localeCompare(sb.sceneNumber || "", undefined, { numeric: true });
      }));
    }
  };

  const totalPages = scenes
    .filter((s) => checkedIds.includes(s.id))
    .reduce((sum, s) => sum + (s.pageCount ?? 0), 0);

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {scenes.map((scene) => {
          const checked = checkedIds.includes(scene.id);
          const otherDays = scheduleStatus[scene.id] ?? [];
          return (
            <li
              key={scene.id}
              className={cn(
                "flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm",
                checked && "bg-primary/5 border-primary/30"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(scene.id)}
                disabled={disabled}
                className="mt-1 h-4 w-4 rounded border-border"
                aria-label={`Include scene ${scene.sceneNumber}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Sc. {scene.sceneNumber}</span>
                  {scene.title && (
                    <span className="text-muted-foreground truncate">{scene.title}</span>
                  )}
                  <span className="text-muted-foreground shrink-0">
                    {[scene.intExt, scene.dayNight].filter(Boolean).join(" · ") || "—"}
                  </span>
                  {scene.pageCount != null && (
                    <span className="text-muted-foreground text-xs">
                      {scene.pageCount} p.
                    </span>
                  )}
                </div>
                {otherDays.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {otherDays.map((d) => (
                      <Link
                        key={d.id}
                        href={`/production/schedule/${d.id}`}
                        className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Also on Day {d.dayNumber} ({localDate(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })})
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {showTotalPages && checkedIds.length > 0 && (
        <p className="text-sm text-muted-foreground border-t border-border pt-2">
          Total: {totalPages.toFixed(1)} pages ({checkedIds.length} scene{checkedIds.length !== 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}
