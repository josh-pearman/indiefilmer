"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type LineItemsTotalsProps = {
  count: number;
  totalPlanned: number;
  totalActual: number;
  className?: string;
};

export function LineItemsTotals({
  count,
  totalPlanned,
  totalActual,
  className
}: LineItemsTotalsProps) {
  const delta = totalPlanned - totalActual;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 border-t border-border pt-3 text-sm",
        className
      )}
    >
      <span className="text-muted-foreground">
        Showing {count} item{count !== 1 ? "s" : ""}
      </span>
      <span className="tabular-nums">
        Total Planned: ${totalPlanned.toLocaleString()}
      </span>
      <span className="tabular-nums">
        Total Actual: ${totalActual.toLocaleString()}
      </span>
      <span
        className={cn(
          "tabular-nums font-medium",
          delta < 0 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        Δ: {delta >= 0 ? "+" : ""}${delta.toLocaleString()}
      </span>
    </div>
  );
}
