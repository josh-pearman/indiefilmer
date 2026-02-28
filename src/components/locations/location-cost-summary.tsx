import { cn } from "@/lib/utils";

type LocationCostSummaryProps = {
  estimatedCostPerDay: number | null;
  numberOfDays: number | null;
  fees: number | null;
  plannedAmount?: number | null;
  currencySymbol?: string;
  className?: string;
};

export function LocationCostSummary({
  estimatedCostPerDay,
  numberOfDays,
  fees,
  plannedAmount,
  currencySymbol = "$",
  className
}: LocationCostSummaryProps) {
  const costPerDay = estimatedCostPerDay ?? 0;
  const days = numberOfDays ?? 0;
  const feesVal = fees ?? 0;
  const total =
    costPerDay > 0 && days > 0
      ? costPerDay * days + feesVal
      : feesVal > 0
        ? feesVal
        : null;

  const variance =
    plannedAmount != null && total != null ? plannedAmount - total : null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planned Budget</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {plannedAmount != null
              ? `${currencySymbol}${plannedAmount.toLocaleString()}`
              : "Not set"}
          </p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated Cost</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {total != null
              ? `${currencySymbol}${total.toLocaleString()}`
              : "No estimate"}
          </p>
          <div className="mt-1 grid gap-1 text-xs text-muted-foreground">
            <span>
              Cost/day: {estimatedCostPerDay != null ? `${currencySymbol}${Number(estimatedCostPerDay).toFixed(2)}` : "—"}
            </span>
            <span>Days: {numberOfDays != null ? numberOfDays : "—"}</span>
            <span>Fees: {fees != null ? `${currencySymbol}${Number(fees).toFixed(2)}` : "—"}</span>
          </div>
        </div>
      </div>
      {variance != null && (
        <p
          className={cn(
            "text-sm font-medium",
            variance >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-destructive"
          )}
        >
          {variance >= 0
            ? `${currencySymbol}${variance.toLocaleString()} under budget`
            : `${currencySymbol}${Math.abs(variance).toLocaleString()} over budget`}
        </p>
      )}
    </div>
  );
}
