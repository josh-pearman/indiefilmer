import { getBudgetRollup } from "@/actions/budget";
import { BudgetTotalEditor } from "@/components/budget/budget-total-editor";
import { BudgetTable } from "@/components/budget/budget-table";
import { BudgetSummary } from "@/components/budget/budget-summary";
import { BudgetTopDrivers } from "@/components/budget/budget-top-drivers";

export default async function BudgetPage() {
  const data = await getBudgetRollup();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Planned vs estimated committed vs actual by bucket.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <BudgetTotalEditor totalBudget={data.totalBudget} currencySymbol={data.currencySymbol} />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <BudgetTable buckets={data.buckets} currencySymbol={data.currencySymbol} />
      </div>

      <BudgetSummary summary={data.summary} totalBudget={data.totalBudget} currencySymbol={data.currencySymbol} />

        <BudgetTopDrivers drivers={data.topCostDrivers} currencySymbol={data.currencySymbol} />
    </div>
  );
}
