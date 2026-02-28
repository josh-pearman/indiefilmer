"use client";

import { cn } from "@/lib/utils";

type BudgetProgressBarProps = {
  planned: number;
  estimatedCommitted: number;
  className?: string;
};

export function BudgetProgressBar({
  planned,
  estimatedCommitted,
  className
}: BudgetProgressBarProps) {
  const pct = planned > 0 ? (estimatedCommitted / planned) * 100 : 0;
  const over = pct > 100;
  const displayPct = Math.min(pct, 100);
  const overflowPct = over ? pct - 100 : 0;

  const barColor =
    pct <= 80
      ? "bg-green-500"
      : pct <= 100
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div
      className={cn("flex h-5 w-24 overflow-hidden rounded bg-muted", className)}
      title={`${estimatedCommitted.toLocaleString()} / ${planned.toLocaleString()} (${pct.toFixed(0)}%)`}
    >
      <div
        className={cn("h-full transition-all", barColor)}
        style={{ width: `${displayPct}%` }}
      />
      {over && (
        <div
          className="h-full bg-red-600 opacity-80"
          style={{ width: `${Math.min(overflowPct, 50)}%` }}
        />
      )}
    </div>
  );
}
