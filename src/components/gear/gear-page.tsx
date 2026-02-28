"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GearPageHeader } from "./gear-page-header";
import { GearModelCard, type GearModelCardData } from "./gear-model-card";
import { GearTotals } from "./gear-totals";
import { Button } from "@/components/ui/button";
import type { ShootDayForGear } from "./gear-item-row";
import { createGearModel } from "@/actions/gear";

type GearPageProps = {
  shootDays: ShootDayForGear[];
  models: GearModelCardData[];
  globalTotalBudget: number;
};

export function GearPage({
  shootDays,
  models,
  globalTotalBudget
}: GearPageProps) {
  const router = useRouter();
  const [budgetMode, setBudgetMode] = React.useState<"local" | "global">(
    "global"
  );
  const [localBudgetAmount, setLocalBudgetAmount] = React.useState(3000);

  const budgetDenominator =
    budgetMode === "local" ? localBudgetAmount : globalTotalBudget;
  const activeModels = models.filter((m) => m.isActive);
  const activeModelNames = activeModels.map((m) => m.name);
  const totalPlannedBudget = activeModels.some((m) => m.plannedAmount != null)
    ? activeModels.reduce((s, m) => s + (m.plannedAmount ?? 0), 0)
    : null;
  const combinedTotal = models
    .filter((m) => m.isActive)
    .reduce((sum, m) => {
      for (const item of m.items) {
        const sel = item.daySelections.filter((d) => d.selected).length;
        sum +=
          item.costType === "per_day"
            ? item.costAmount * sel
            : item.costAmount;
      }
      return sum;
    }, 0);

  const handleUpdate = () => {
    router.refresh();
  };

  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-12">
        <p className="text-muted-foreground">No gear models yet.</p>
        <Button
          type="button"
          onClick={async () => {
            await createGearModel();
            router.refresh();
          }}
        >
          + Create First Model
        </Button>
      </div>
    );
  }

  if (shootDays.length === 0) {
    return (
      <div className="space-y-6">
        <GearPageHeader
          budgetMode={budgetMode}
          setBudgetMode={setBudgetMode}
          localBudgetAmount={localBudgetAmount}
          setLocalBudgetAmount={setLocalBudgetAmount}
          globalTotalBudget={globalTotalBudget}
          activeTotal={combinedTotal}
          onModelCreated={handleUpdate}
        />
        <p className="text-sm text-muted-foreground">
          No shoot days scheduled. Add shoot days in the Schedule module to
          select rental days.
        </p>
        {models.map((model, index) => (
          <GearModelCard
            key={model.id}
            model={model}
            shootDays={[]}
            canMoveUp={index > 0}
            canMoveDown={index < models.length - 1}
            onUpdate={handleUpdate}
          />
        ))}
        <GearTotals
          activeModelNames={activeModelNames}
          combinedTotal={combinedTotal}
          totalPlannedBudget={totalPlannedBudget}
          budgetDenominator={budgetDenominator}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GearPageHeader
        budgetMode={budgetMode}
        setBudgetMode={setBudgetMode}
        localBudgetAmount={localBudgetAmount}
        setLocalBudgetAmount={setLocalBudgetAmount}
        globalTotalBudget={globalTotalBudget}
        activeTotal={combinedTotal}
        onModelCreated={handleUpdate}
      />

      {models.map((model, index) => (
        <GearModelCard
          key={model.id}
          model={model}
          shootDays={shootDays}
          canMoveUp={index > 0}
          canMoveDown={index < models.length - 1}
          onUpdate={handleUpdate}
        />
      ))}

      <GearTotals
        activeModelNames={activeModelNames}
        combinedTotal={combinedTotal}
        totalPlannedBudget={totalPlannedBudget}
        budgetDenominator={budgetDenominator}
      />
    </div>
  );
}
