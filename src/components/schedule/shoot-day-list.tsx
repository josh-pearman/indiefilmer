"use client";

import * as React from "react";
import { ShootDayForm } from "@/components/schedule/shoot-day-form";
import { ShootDayCard } from "@/components/schedule/shoot-day-card";

export type ShootDayListItem = {
  id: string;
  date: string;
  dayNumber: number;
  locationName: string | null;
  sceneCount: number;
  sceneNumbers: string[];
  notesPreview: string | null;
  isDeleted?: boolean;
  locationColor?: string | null;
};

type ShootDayListProps = {
  shootDays: ShootDayListItem[];
  totalSceneAssignments: number;
  locations: Array<{ id: string; name: string }>;
  unlinkedCateringDays?: Array<{ id: string; date: string; label: string }>;
};

export function ShootDayList({
  shootDays,
  totalSceneAssignments,
  locations,
  unlinkedCateringDays
}: ShootDayListProps) {
  const [showDeleted, setShowDeleted] = React.useState(false);
  const visible = showDeleted
    ? shootDays
    : shootDays.filter((d) => !d.isDeleted);
  const deletedCount = shootDays.filter((d) => d.isDeleted).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <ShootDayForm locations={locations} unlinkedCateringDays={unlinkedCateringDays} />
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

      <p className="text-sm text-muted-foreground">
        {visible.filter((d) => !d.isDeleted).length} shoot day
        {visible.filter((d) => !d.isDeleted).length !== 1 ? "s" : ""}
        {" · "}
        {totalSceneAssignments} total scene assignment
        {totalSceneAssignments !== 1 ? "s" : ""}
        {deletedCount > 0 && !showDeleted && (
          <> ({deletedCount} deleted)</>
        )}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {showDeleted
            ? "No shoot days match."
            : "No shoot days scheduled yet. Add your first day to start building the schedule."}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((day) => (
            <li key={day.id}>
              <ShootDayCard
                id={day.id}
                date={day.date}
                dayNumber={day.dayNumber}
                locationName={day.locationName}
                sceneCount={day.sceneCount}
                sceneNumbers={day.sceneNumbers}
                notesPreview={day.notesPreview}
                isDeleted={day.isDeleted}
                locationColor={day.locationColor}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
