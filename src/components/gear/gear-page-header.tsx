"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench } from "lucide-react";
import { createGearModel } from "@/actions/gear";
import { type ActionResult } from "@/lib/action-result";

export type BudgetMode = "local" | "global";

type GearPageHeaderProps = {
  budgetMode: BudgetMode;
  setBudgetMode: (m: BudgetMode) => void;
  localBudgetAmount: number;
  setLocalBudgetAmount: (n: number) => void;
  globalTotalBudget: number;
  activeTotal: number;
  onModelCreated?: () => void;
};

export function GearPageHeader({
  budgetMode,
  setBudgetMode,
  localBudgetAmount,
  setLocalBudgetAmount,
  globalTotalBudget,
  activeTotal,
  onModelCreated
}: GearPageHeaderProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const budgetDenominator =
    budgetMode === "local" ? localBudgetAmount : globalTotalBudget;
  const percentage =
    budgetDenominator > 0
      ? Math.round((activeTotal / budgetDenominator) * 1000) / 10
      : 0;

  const handleNewModel = async () => {
    setError(null);
    setPending(true);
    const result: ActionResult = await createGearModel();
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onModelCreated?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Budget Impact:</span>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="budgetMode"
              checked={budgetMode === "local"}
              onChange={() => setBudgetMode("local")}
              className="h-4 w-4"
            />
            Local
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="budgetMode"
              checked={budgetMode === "global"}
              onChange={() => setBudgetMode("global")}
              className="h-4 w-4"
            />
            Global
          </label>
        </div>
        {budgetMode === "local" && (
          <div className="flex items-center gap-2">
            <Label htmlFor="local-budget" className="text-sm whitespace-nowrap">
              $
            </Label>
            <Input
              id="local-budget"
              type="number"
              min={0}
              step={100}
              value={localBudgetAmount || ""}
              onChange={(e) =>
                setLocalBudgetAmount(Number(e.target.value) || 0)
              }
              className="w-28"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Active Model Total: ${activeTotal.toLocaleString()} of $
          {budgetDenominator.toLocaleString()} ({percentage}%)
        </p>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-sm text-destructive">{error}</span>
          )}
          <Button
            type="button"
            onClick={handleNewModel}
            disabled={pending}
            variant="outline"
          >
            <Wrench className="mr-2 h-4 w-4" />
            {pending ? "Creating…" : "+ New Model"}
          </Button>
        </div>
      </div>
    </div>
  );
}
