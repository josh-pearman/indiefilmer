"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CraftServicesDayColumn, type DayMeal } from "./craft-services-day-column";
import { CraftServicesTotals } from "./craft-services-totals";
import { AddCateringDayDialog } from "./add-catering-day-dialog";

export type DietaryEntry = {
  name: string;
  restrictions: string;
};

export type CraftServicesDay = {
  id: string;
  dayLabel: string;
  dateFormatted: string;
  sortDate: Date | null;
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
};

type CraftServicesGridProps = {
  days: CraftServicesDay[];
  totalEstimated: number;
  totalActual: number;
};

export function CraftServicesGrid({
  days,
  totalEstimated,
  totalActual
}: CraftServicesGridProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (days.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          No catering days yet. Add a standalone day to start planning meals, or
          add shoot days in the Schedule module.
        </p>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Add Day
        </Button>
        <AddCateringDayDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {
            setDialogOpen(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 no-print">
        <Button type="button" onClick={() => setDialogOpen(true)}>
          Add Day
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <div className="overflow-x-auto craft-services-grid-print">
        <div className="flex min-w-0">
          <div className="sticky left-0 z-10 flex w-40 shrink-0 flex-col border border-border bg-background">
            <div className="border-b border-border p-2 font-medium">
              &nbsp;
            </div>
            <div className="border-b border-border p-2 font-medium">
              HEADCOUNT
            </div>
            <div className="space-y-0.5 border-b border-border px-2 py-1 text-sm text-muted-foreground">
              <div>Cast</div>
              <div>Crew</div>
              <div>Total</div>
            </div>
            <div className="border-b border-border p-2 font-medium">
              DIETARY
            </div>
            <div className="border-b border-border p-2 font-medium">
              CRAFTY
            </div>
            <div className="border-b border-border p-2 font-medium">
              LUNCH
            </div>
            <div className="border-b border-border p-2 font-medium">
              DINNER
            </div>
            <div className="border-b border-border p-2 font-medium">
              DAY TOTAL
            </div>
          </div>
          <div className="flex">
            {days.map((day) => (
              <CraftServicesDayColumn
                key={day.id}
                dayId={day.id}
                dayLabel={day.dayLabel}
                dateFormatted={day.dateFormatted}
                locationName={day.locationName}
                castCount={day.castCount}
                crewCount={day.crewCount}
                totalHeadcount={day.totalHeadcount}
                dietaryEntries={day.dietaryEntries}
                meals={day.meals}
                defaultEstimatedCosts={day.defaultEstimatedCosts}
                isStandalone={day.isStandalone}
                headcount={day.headcount}
                linkedShootDayId={day.linkedShootDayId}
                onUpdate={() => router.refresh()}
              />
            ))}
          </div>
        </div>
      </div>
      <CraftServicesTotals
        totalEstimated={totalEstimated}
        totalActual={totalActual}
      />
      <AddCateringDayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
