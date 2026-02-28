"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  toggleGearItemDay,
  toggleAllGearItemDays,
  updateGearItem,
  deleteGearItem,
  type GearItemData
} from "@/actions/gear";
import { GearDayColumns } from "./gear-day-columns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Camera",
  "Grip",
  "Audio",
  "Lighting",
  "Power",
  "Monitoring",
  "Other"
] as const;

export type GearItemDaySelection = {
  shootDayId: string;
  selected: boolean;
};

export type GearItemRowData = {
  id: string;
  name: string;
  category: string;
  costAmount: number;
  costType: "per_day" | "flat_rate";
  supplier: string | null;
  daySelections: GearItemDaySelection[];
};

export type ShootDayForGear = {
  id: string;
  date: string;
  label: string;
};

type GearItemRowProps = {
  item: GearItemRowData;
  shootDays: ShootDayForGear[];
  rowTotal: number;
  onUpdate: () => void;
};

export function GearItemRow({
  item,
  shootDays,
  rowTotal,
  onUpdate
}: GearItemRowProps) {
  const router = useRouter();
  const [name, setName] = React.useState(item.name);
  const [costAmount, setCostAmount] = React.useState(String(item.costAmount));
  const [supplier, setSupplier] = React.useState(item.supplier ?? "");
  const [pending, setPending] = React.useState(false);

  const allSelected =
    item.daySelections.length > 0 &&
    item.daySelections.every((d) => d.selected);
  const someSelected = item.daySelections.some((d) => d.selected);

  const handleBlurName = () => {
    const v = name.trim();
    if (v === item.name) return;
    setPending(true);
    updateGearItem(item.id, { name: v || "" }).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleBlurCost = () => {
    const n = Number(costAmount);
    if (Number.isNaN(n) || n < 0 || n === item.costAmount) return;
    setPending(true);
    updateGearItem(item.id, { costAmount: n }).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleBlurSupplier = () => {
    const v = supplier.trim() || null;
    if (v === (item.supplier ?? "")) return;
    setPending(true);
    updateGearItem(item.id, { supplier: v || undefined }).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleCategoryChange = (category: string) => {
    setPending(true);
    updateGearItem(item.id, { category }).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleCostTypeChange = (costType: "per_day" | "flat_rate") => {
    setPending(true);
    updateGearItem(item.id, { costType }).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  const handleToggleDay = (shootDayId: string) => {
    toggleGearItemDay(item.id, shootDayId).then(() => {
      onUpdate();
      router.refresh();
    });
  };

  const handleToggleAll = () => {
    toggleAllGearItemDays(item.id, !allSelected).then(() => {
      onUpdate();
      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!confirm("Remove this gear item?")) return;
    setPending(true);
    deleteGearItem(item.id).then(() => {
      setPending(false);
      onUpdate();
      router.refresh();
    });
  };

  return (
    <tr className={cn("border-b border-border", pending && "opacity-60")}>
      <td className="p-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlurName}
          placeholder="Item name"
          className="h-8 text-sm"
        />
      </td>
      <td className="p-2">
        <select
          value={item.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <Input
          type="number"
          min={0}
          step={0.01}
          value={costAmount}
          onChange={(e) => setCostAmount(e.target.value)}
          onBlur={handleBlurCost}
          className="h-8 w-20 text-sm"
        />
      </td>
      <td className="p-2">
        <div className="flex gap-2 text-sm">
          <label className="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name={`rate-${item.id}`}
              checked={item.costType === "per_day"}
              onChange={() => handleCostTypeChange("per_day")}
              className="h-3 w-3"
            />
            Per day
          </label>
          <label className="flex cursor-pointer items-center gap-1">
            <input
              type="radio"
              name={`rate-${item.id}`}
              checked={item.costType === "flat_rate"}
              onChange={() => handleCostTypeChange("flat_rate")}
              className="h-3 w-3"
            />
            Flat
          </label>
        </div>
      </td>
      <td className="p-2">
        <Input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          onBlur={handleBlurSupplier}
          placeholder="Supplier"
          className="h-8 text-sm"
        />
      </td>
      <GearDayColumns
        itemId={item.id}
        daySelections={item.daySelections}
        shootDays={shootDays}
        allSelected={allSelected}
        onToggleDay={handleToggleDay}
        onToggleAll={handleToggleAll}
      />
      <td className="p-2 text-right font-medium tabular-nums">
        ${rowTotal.toLocaleString()}
      </td>
      <td className="p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={pending}
        >
          ×
        </Button>
      </td>
    </tr>
  );
}
