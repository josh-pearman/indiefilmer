"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { updateBucketPlanned } from "@/actions/budget";
import { BudgetProgressBar } from "./budget-progress-bar";
import type { BudgetRollupBucket } from "@/lib/budget-rollup";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type BudgetTableProps = {
  buckets: BudgetRollupBucket[];
  currencySymbol?: string;
  onUpdate?: () => void;
};

export function BudgetTable({ buckets, currencySymbol = "$", onUpdate }: BudgetTableProps) {
  const router = useRouter();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handleStartEdit = (b: BudgetRollupBucket) => {
    setEditingId(b.id);
    setEditValue(String(b.planned));
  };

  const handleSavePlanned = (bucketId: string) => {
    const n = Number(editValue.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(n) || n < 0) return;
    setEditingId(null);
    setPendingId(bucketId);
    updateBucketPlanned(bucketId, n).then(() => {
      setPendingId(null);
      onUpdate?.();
      router.refresh();
    });
  };

  const totals = React.useMemo(() => {
    return buckets.reduce(
      (acc, b) => ({
        planned: acc.planned + b.planned,
        entityPlanned: acc.entityPlanned + b.entityPlanned,
        actual: acc.actual + b.actualSpent
      }),
      { planned: 0, entityPlanned: 0, actual: 0 }
    );
  }, [buckets]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-2 pr-4 text-left font-medium">Bucket</th>
            <th className="pb-2 pr-4 text-right font-medium">Planned</th>
            <th className="pb-2 pr-4 text-right font-medium text-muted-foreground">Entity Planned</th>
            <th className="pb-2 pr-4 text-right font-medium">Actual</th>
            <th className="pb-2 pr-4 text-right font-medium">Delta</th>
            <th className="pb-2 pr-4 text-left font-medium">Progress</th>
            <th className="pb-2 text-left font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.id} className="border-b border-border/60">
              <td className="py-2 pr-4 font-medium">{b.name}</td>
              <td className="py-2 pr-4 text-right">
                {editingId === b.id ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={editValue}
                    onChange={(e) =>
                      setEditValue(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    onBlur={() => handleSavePlanned(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSavePlanned(b.id);
                    }}
                    className="h-8 w-24 font-mono"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(b)}
                    disabled={pendingId === b.id}
                    className="tabular-nums text-right hover:underline"
                  >
                    {currencySymbol}{b.planned.toLocaleString()}
                  </button>
                )}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {b.entityPlanned > 0
                  ? `${currencySymbol}${b.entityPlanned.toLocaleString()}`
                  : "—"}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {currencySymbol}{b.actualSpent.toLocaleString()}
              </td>
              <td
                className={cn(
                  "py-2 pr-4 text-right tabular-nums",
                  b.delta < 0 ? "text-destructive font-medium" : "text-muted-foreground"
                )}
              >
                {b.delta >= 0 ? "+" : ""}{currencySymbol}{b.delta.toLocaleString()}
                {b.delta < 0 && (
                  <AlertTriangle className="ml-0.5 inline h-4 w-4" />
                )}
              </td>
              <td className="py-2 pr-4">
                <BudgetProgressBar
                  planned={b.planned}
                  estimatedCommitted={b.estimatedCommitted}
                />
              </td>
              <td className="py-2">
                <Link
                  href={`/budget-line-items?bucket=${encodeURIComponent(b.name)}`}
                  className="text-primary hover:underline"
                >
                  View Line Items
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-medium">
            <td className="py-2 pr-4">TOTALS</td>
            <td className="py-2 pr-4 text-right tabular-nums">
              {currencySymbol}{totals.planned.toLocaleString()}
            </td>
            <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
              {totals.entityPlanned > 0
                ? `${currencySymbol}${totals.entityPlanned.toLocaleString()}`
                : "—"}
            </td>
            <td className="py-2 pr-4 text-right tabular-nums">
              {currencySymbol}{totals.actual.toLocaleString()}
            </td>
            <td className="py-2 pr-4" />
            <td className="py-2 pr-4" />
            <td className="py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
