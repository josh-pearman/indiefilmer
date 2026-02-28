"use client";

import { cn } from "@/lib/utils";

type GearTotalsProps = {
  activeModelNames: string[];
  combinedTotal: number;
  totalPlannedBudget: number | null;
  budgetDenominator: number;
  className?: string;
};

export function GearTotals({
  activeModelNames,
  combinedTotal,
  totalPlannedBudget,
  budgetDenominator,
  className
}: GearTotalsProps) {
  const percentage =
    budgetDenominator > 0
      ? Math.round((combinedTotal / budgetDenominator) * 1000) / 10
      : 0;

  const variance =
    totalPlannedBudget != null && combinedTotal > 0
      ? totalPlannedBudget - combinedTotal
      : null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4 space-y-2",
        className
      )}
    >
      <h3 className="text-base font-semibold">Totals</h3>
      <p className="text-sm text-muted-foreground">
        Active Models:{" "}
        {activeModelNames.length === 0
          ? "None"
          : activeModelNames.join(", ")}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planned Budget</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {totalPlannedBudget != null
              ? `$${totalPlannedBudget.toLocaleString()}`
              : "Not set"}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Combined Gear Cost</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            ${combinedTotal.toLocaleString()}
          </p>
        </div>
      </div>
      {variance != null && (
        <p className={cn(
          "text-sm font-medium",
          variance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
        )}>
          {variance >= 0
            ? `$${variance.toLocaleString()} under budget`
            : `$${Math.abs(variance).toLocaleString()} over budget`}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Budget Impact: ${combinedTotal.toLocaleString()} of $
        {budgetDenominator.toLocaleString()} ({percentage}%)
      </p>
    </div>
  );
}
