import type { BudgetRollupData } from "@/lib/budget-rollup";

type BudgetSummaryProps = {
  summary: BudgetRollupData["summary"];
  totalBudget: number;
  currencySymbol?: string;
};

export function BudgetSummary({ summary, totalBudget, currencySymbol = "$" }: BudgetSummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-semibold">Summary</h3>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Total Budget</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{totalBudget.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Planned</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{summary.totalPlanned.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Entity Planned</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{summary.totalEntityPlanned.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Est. Committed</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{summary.totalEstimated.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total Actual Spent</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{summary.totalActual.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Remaining Budget</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{summary.remaining.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unallocated</dt>
          <dd className="font-medium tabular-nums">
            {currencySymbol}{summary.unallocated.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
