"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  updateGearModelName,
  updateGearModelPlannedBudget,
  toggleGearModelActive,
  deleteGearModel,
  addGearItem,
  reorderGearModelUp,
  reorderGearModelDown
} from "@/actions/gear";
import { GearItemRow, type GearItemRowData, type ShootDayForGear } from "./gear-item-row";
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function itemRowTotal(
  item: GearItemRowData,
  costType: string,
  costAmount: number,
  selectedDays: number
): number {
  if (costType === "flat_rate") return costAmount;
  return costAmount * selectedDays;
}

function categoryBreakdown(items: GearItemRowData[]): Record<string, number> {
  const byCategory: Record<string, number> = {};
  for (const item of items) {
    const selected = item.daySelections.filter((d) => d.selected).length;
    const total = item.costType === "per_day"
      ? item.costAmount * selected
      : item.costAmount;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + total;
  }
  return byCategory;
}

export type GearModelCardData = {
  id: string;
  name: string;
  isActive: boolean;
  plannedAmount?: number | null;
  items: GearItemRowData[];
};

type GearModelCardProps = {
  model: GearModelCardData;
  shootDays: ShootDayForGear[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: () => void;
};

export function GearModelCard({
  model,
  shootDays,
  canMoveUp,
  canMoveDown,
  onUpdate
}: GearModelCardProps) {
  const router = useRouter();
  const [name, setName] = React.useState(model.name);
  const [plannedBudget, setPlannedBudget] = React.useState(
    model.plannedAmount != null ? String(model.plannedAmount) : ""
  );
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setName(model.name);
  }, [model.name]);

  React.useEffect(() => {
    setPlannedBudget(model.plannedAmount != null ? String(model.plannedAmount) : "");
  }, [model.plannedAmount]);

  const modelTotal = React.useMemo(() => {
    let sum = 0;
    for (const item of model.items) {
      const selected = item.daySelections.filter((d) => d.selected).length;
      sum += item.costType === "per_day"
        ? item.costAmount * selected
        : item.costAmount;
    }
    return sum;
  }, [model.items]);

  const breakdown = React.useMemo(
    () => categoryBreakdown(model.items),
    [model.items]
  );
  const breakdownLine = Object.entries(breakdown)
    .filter(([, v]) => v > 0)
    .map(([cat, v]) => `${cat} $${v.toLocaleString()}`)
    .join(" | ") || "No items";

  const handleBlurName = () => {
    const v = name.trim();
    if (v === model.name) return;
    if (!v) {
      setName(model.name);
      return;
    }
    setPending(true);
    updateGearModelName(model.id, v).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleBlurPlannedBudget = () => {
    const raw = plannedBudget.trim();
    const newVal = raw === "" ? null : Number(raw);
    const oldVal = model.plannedAmount ?? null;
    if (newVal === oldVal) return;
    if (newVal !== null && (!Number.isFinite(newVal) || newVal < 0)) {
      setPlannedBudget(model.plannedAmount != null ? String(model.plannedAmount) : "");
      return;
    }
    setPending(true);
    updateGearModelPlannedBudget(model.id, newVal).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleMoveUp = () => {
    if (!canMoveUp) return;
    setPending(true);
    reorderGearModelUp(model.id).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleMoveDown = () => {
    if (!canMoveDown) return;
    setPending(true);
    reorderGearModelDown(model.id).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleToggleActive = () => {
    setPending(true);
    toggleGearModelActive(model.id).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this model and all its items?")) return;
    setPending(true);
    deleteGearModel(model.id).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleAddRow = () => {
    setPending(true);
    addGearItem(model.id).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleMoveUp}
                disabled={!canMoveUp || pending}
                title="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleMoveDown}
                disabled={!canMoveDown || pending}
                title="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleBlurName}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.target as HTMLInputElement).blur()
              }
              placeholder="Model name"
              className="h-9 w-48 text-base font-semibold"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={model.isActive}
                onChange={handleToggleActive}
                disabled={pending}
                className="h-4 w-4 rounded border-input"
              />
              Active
            </label>
            <span className="text-sm font-medium tabular-nums">
              Total: ${modelTotal.toLocaleString()}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
              title="Delete model"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Category Breakdown: {breakdownLine}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="p-2 text-left font-medium">Name</th>
              <th className="p-2 text-left font-medium">Category</th>
              <th className="p-2 text-left font-medium">Cost</th>
              <th className="p-2 text-left font-medium">Rate</th>
              <th className="p-2 text-left font-medium">Supplier</th>
              <th className="p-2 text-center font-medium">All</th>
              {shootDays.map((day) => (
                <th
                  key={day.id}
                  className="p-2 text-center font-medium min-w-[3rem]"
                  title={day.date}
                >
                  {day.label}
                </th>
              ))}
              <th className="p-2 text-right font-medium">Row Total</th>
              <th className="p-2 w-10" />
            </tr>
          </thead>
          <tbody>
            {model.items.map((item) => {
              const selectedDays = item.daySelections.filter(
                (d) => d.selected
              ).length;
              const rowTotal = itemRowTotal(
                item,
                item.costType,
                item.costAmount,
                selectedDays
              );
              return (
                <GearItemRow
                  key={item.id}
                  item={item}
                  shootDays={shootDays}
                  rowTotal={rowTotal}
                  onUpdate={onUpdate}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-border p-3 space-y-3">
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={pending}
          >
            + Add Row
          </Button>
          <span className="text-sm font-medium tabular-nums">
            Model Total: ${modelTotal.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Planned Budget ($)</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={plannedBudget}
              onChange={(e) => setPlannedBudget(e.target.value)}
              onBlur={handleBlurPlannedBudget}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              placeholder="Not set"
              className="h-8 w-28 text-sm"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Estimated Cost</p>
            <p className="text-sm font-semibold tabular-nums">${modelTotal.toLocaleString()}</p>
          </div>
          {model.plannedAmount != null && modelTotal > 0 && (() => {
            const variance = model.plannedAmount - modelTotal;
            return (
              <p className={cn(
                "text-xs font-medium",
                variance >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
              )}>
                {variance >= 0
                  ? `$${variance.toLocaleString()} under budget`
                  : `$${Math.abs(variance).toLocaleString()} over budget`}
              </p>
            );
          })()}
        </div>
      </div>
    </Card>
  );
}
