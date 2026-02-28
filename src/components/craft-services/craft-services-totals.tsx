"use client";

type CraftServicesTotalsProps = {
  totalEstimated: number;
  totalActual: number;
};

export function CraftServicesTotals({
  totalEstimated,
  totalActual
}: CraftServicesTotalsProps) {
  const remaining = totalEstimated - totalActual;
  return (
    <div className="flex flex-wrap items-center gap-6 border-t border-border pt-4 text-sm font-medium">
      <span>Total Estimated: ${totalEstimated.toFixed(0)}</span>
      <span>Total Actual: ${totalActual.toFixed(0)}</span>
      <span>Remaining: ${remaining.toFixed(0)}</span>
    </div>
  );
}
