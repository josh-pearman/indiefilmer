import { getBudgetRollup } from "@/actions/budget";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getAccountingStats() {
  const projectId = await requireCurrentProjectId();

  const [rollup, recentExpenses] = await Promise.all([
    getBudgetRollup(),
    prisma.budgetLineItem.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, description: true, bucketId: true, plannedAmount: true, actualAmount: true, createdAt: true },
    }),
  ]);

  return { rollup, recentExpenses };
}

export default async function AccountingPage() {
  const { rollup, recentExpenses } = await getAccountingStats();
  const { totalBudget, currencySymbol, summary } = rollup;
  const budgetTotal = totalBudget || 1;
  const spentPct = Math.min(100, (summary.totalActual / budgetTotal) * 100);
  const committedPct = Math.min(100 - spentPct, (Math.max(0, summary.totalEstimated - summary.totalActual) / budgetTotal) * 100);
  const remainingPct = Math.max(0, 100 - spentPct - committedPct);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Accounting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Budget overview and expense tracking.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Budget Overview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{currencySymbol}{summary.remaining.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">remaining of {currencySymbol}{totalBudget.toLocaleString()}</span>
          </div>
          <div className="flex h-6 w-full overflow-hidden rounded-full bg-muted">
            {spentPct > 0 && (
              <div
                className="flex items-center justify-center bg-red-500 text-[10px] font-medium text-white"
                style={{ width: `${spentPct}%` }}
              >
                {spentPct >= 10 ? `${currencySymbol}${summary.totalActual.toLocaleString()}` : ""}
              </div>
            )}
            {committedPct > 0 && (
              <div
                className="flex items-center justify-center bg-amber-500 text-[10px] font-medium text-white"
                style={{ width: `${committedPct}%` }}
              >
                {committedPct >= 10 ? `${currencySymbol}${(summary.totalEstimated - summary.totalActual).toLocaleString()}` : ""}
              </div>
            )}
            {remainingPct > 0 && (
              <div
                className="flex items-center justify-center bg-green-500 text-[10px] font-medium text-white"
                style={{ width: `${remainingPct}%` }}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />Spent</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />Committed</span>
            <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" />Remaining</span>
          </div>
          <Link href="/accounting/budget" className="inline-block text-xs text-primary hover:underline">
            View full budget →
          </Link>
        </CardContent>
      </Card>

      {recentExpenses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Expenses</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {recentExpenses.map((e) => (
                <li key={e.id} className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0 last:pb-0">
                  <div>
                    <p className="font-medium">{e.description || e.bucketId}</p>
                    <p className="text-xs text-muted-foreground">{e.bucketId}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {e.actualAmount > 0
                      ? <span className="font-medium text-foreground">{currencySymbol}{e.actualAmount.toLocaleString()}</span>
                      : <span>Est. {currencySymbol}{(e.plannedAmount ?? 0).toLocaleString()}</span>
                    }
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/accounting/expenses" className="mt-3 inline-block text-xs text-primary hover:underline">
              All expenses →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
