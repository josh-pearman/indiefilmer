"use client";

import * as React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateShootDayMeal, updateCateringDayMeal, deleteCateringDay } from "@/actions/craft-services";
import { DietaryRestrictionsDialog } from "./dietary-restrictions-dialog";
import type { DietaryEntry } from "./craft-services-grid";

export type DayMeal = {
  id: string;
  mealType: string;
  enabled: boolean;
  vendor: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  notes: string | null;
};

type CraftServicesDayColumnProps = {
  dayId: string;
  dayLabel: string;
  dateFormatted: string;
  locationName: string;
  castCount: number;
  crewCount: number;
  totalHeadcount: number;
  dietaryEntries: DietaryEntry[];
  meals: DayMeal[];
  defaultEstimatedCosts: Record<string, number>;
  isStandalone?: boolean;
  headcount?: number;
  linkedShootDayId?: string;
  onUpdate: () => void;
};

const MEAL_LABELS: Record<string, string> = {
  crafty: "Crafty",
  lunch: "Lunch",
  dinner: "Dinner"
};

export function CraftServicesDayColumn({
  dayId,
  dayLabel,
  dateFormatted,
  locationName,
  castCount,
  crewCount,
  totalHeadcount,
  dietaryEntries,
  meals,
  defaultEstimatedCosts,
  isStandalone,
  headcount,
  linkedShootDayId,
  onUpdate
}: CraftServicesDayColumnProps) {
  const [deleting, setDeleting] = React.useState(false);

  const handleBlur = async (
    mealId: string,
    field: keyof DayMeal,
    value: boolean | string | number | null
  ) => {
    const payload: {
      enabled?: boolean;
      vendor?: string;
      estimatedCost?: number | null;
      actualCost?: number | null;
      notes?: string;
    } = {};
    if (field === "enabled") payload.enabled = value as boolean;
    if (field === "vendor") payload.vendor = (value as string) || undefined;
    if (field === "estimatedCost") payload.estimatedCost = value as number | null;
    if (field === "actualCost") payload.actualCost = value as number | null;
    if (field === "notes") payload.notes = (value as string) || undefined;

    if (isStandalone) {
      await updateCateringDayMeal(mealId, payload);
    } else {
      await updateShootDayMeal(mealId, payload);
    }
    onUpdate();
  };

  const handleDelete = async () => {
    if (!confirm("Delete this catering day?")) return;
    setDeleting(true);
    await deleteCateringDay(dayId);
    onUpdate();
  };

  const mealByType = Object.fromEntries(meals.map((m) => [m.mealType, m]));
  const dayEstimated = meals
    .filter((m) => m.enabled)
    .reduce(
      (s, m) =>
        s + (m.estimatedCost ?? defaultEstimatedCosts[m.mealType] ?? 0),
      0
    );
  const dayActual = meals
    .filter((m) => m.enabled)
    .reduce((s, m) => s + (m.actualCost ?? 0), 0);

  return (
    <div className="flex min-w-[200px] flex-col border-l border-border bg-muted/20">
      {/* Header */}
      <div className="border-b border-border p-2 text-center">
        <div className="font-medium">{dayLabel}</div>
        {isStandalone && !linkedShootDayId ? (
          <div className="text-sm text-muted-foreground">{dateFormatted}</div>
        ) : (
          <Link
            href={`/production/schedule/${linkedShootDayId ?? dayId}`}
            className="text-sm text-primary hover:underline"
          >
            {dateFormatted}
          </Link>
        )}
        <div className="text-xs text-muted-foreground">{locationName}</div>
      </div>

      {/* Headcount */}
      <div className="space-y-1 p-2 text-center text-sm">
        {isStandalone && !linkedShootDayId ? (
          <>
            <div>Headcount: {headcount ?? totalHeadcount}</div>
            <div>&nbsp;</div>
            <div>&nbsp;</div>
          </>
        ) : (
          <>
            <div>Cast: {castCount}</div>
            <div>Crew: {crewCount}</div>
            <div className="font-medium">Total: {totalHeadcount}</div>
          </>
        )}
      </div>

      {/* Dietary */}
      <div className="border-t border-border p-2 text-center text-xs">
        {dietaryEntries.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <DietaryRestrictionsDialog
            dayLabel={dayLabel}
            entries={dietaryEntries}
          />
        )}
      </div>

      {/* Meals */}
      {(["crafty", "lunch", "dinner"] as const).map((mealType) => {
        const meal = mealByType[mealType];
        if (!meal) return null;
        return (
          <div
            key={meal.id}
            className="space-y-1 border-t border-border p-2 text-sm"
          >
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={meal.enabled}
                onChange={(e) =>
                  handleBlur(meal.id, "enabled", e.target.checked)
                }
                className="rounded border-border"
              />
              <span className="text-xs text-muted-foreground">
                {MEAL_LABELS[mealType]}
              </span>
            </label>
            {meal.enabled ? (
              <>
                <Input
                  placeholder="Vendor"
                  defaultValue={meal.vendor ?? ""}
                  onBlur={(e) => handleBlur(meal.id, "vendor", e.target.value)}
                  className="h-8 text-xs"
                />
                <div className="flex gap-1">
                  <span className="text-xs text-muted-foreground">Est:</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder={String(defaultEstimatedCosts[mealType] ?? "")}
                    defaultValue={
                      meal.estimatedCost != null ? String(meal.estimatedCost) : ""
                    }
                    onBlur={(e) => {
                      const v = e.target.value;
                      handleBlur(
                        meal.id,
                        "estimatedCost",
                        v === "" ? null : Number(v)
                      );
                    }}
                    className="h-8 w-20 text-xs"
                  />
                </div>
                <div className="flex gap-1">
                  <span className="text-xs text-muted-foreground">Actual:</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={
                      meal.actualCost != null ? String(meal.actualCost) : ""
                    }
                    onBlur={(e) => {
                      const v = e.target.value;
                      handleBlur(
                        meal.id,
                        "actualCost",
                        v === "" ? null : Number(v)
                      );
                    }}
                    className="h-8 w-20 text-xs"
                  />
                </div>
                <Input
                  placeholder="Notes"
                  defaultValue={meal.notes ?? ""}
                  onBlur={(e) => handleBlur(meal.id, "notes", e.target.value)}
                  className="h-8 text-xs"
                />
              </>
            ) : (
              <div className="text-xs text-muted-foreground">—</div>
            )}
          </div>
        );
      })}

      {/* Day total + delete */}
      <div className="mt-auto border-t border-border p-2 text-center text-xs">
        <div>Est: ${dayEstimated.toFixed(0)}</div>
        <div>Actual: ${dayActual.toFixed(0)}</div>
        {isStandalone && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 h-6 text-xs text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        )}
      </div>
    </div>
  );
}
