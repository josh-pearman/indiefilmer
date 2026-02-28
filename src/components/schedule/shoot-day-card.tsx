"use client";

import Link from "next/link";
import { cn, localDate } from "@/lib/utils";

export type ShootDayCardProps = {
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

export function ShootDayCard({
  id,
  date,
  dayNumber,
  locationName,
  sceneCount,
  sceneNumbers,
  notesPreview,
  isDeleted = false,
  locationColor
}: ShootDayCardProps) {
  const formattedDate = localDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  return (
    <Link
      href={`/production/schedule/${id}`}
      className={cn(
        "block rounded-lg border border-border bg-card text-card-foreground shadow-card transition-colors hover:bg-muted/50",
        isDeleted && "opacity-70"
      )}
    >
      <div
        className="flex rounded-lg border-l-4 border-l-primary/50 p-4"
        style={locationColor ? { borderLeftColor: locationColor } : undefined}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{formattedDate}</span>
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
              Day {dayNumber}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {locationName ?? "No location"}
          </p>
          <p className="mt-1 text-sm">
            {sceneCount} scene{sceneCount !== 1 ? "s" : ""}
            {sceneNumbers.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                — Sc. {sceneNumbers.join(", ")}
              </span>
            )}
          </p>
          {notesPreview && (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {notesPreview}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
