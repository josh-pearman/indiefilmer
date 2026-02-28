"use client";

import * as React from "react";
import type { GearItemDaySelection, ShootDayForGear } from "./gear-item-row";

function AllCheckbox({
  allSelected,
  someSelected,
  onToggle
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = !allSelected && someSelected;
  }, [allSelected, someSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={onToggle}
      className="h-4 w-4 rounded border-input"
      title="Toggle all days"
    />
  );
}

type GearDayColumnsProps = {
  itemId: string;
  daySelections: GearItemDaySelection[];
  shootDays: ShootDayForGear[];
  allSelected: boolean;
  onToggleDay: (shootDayId: string) => void;
  onToggleAll: () => void;
};

export function GearDayColumns({
  itemId,
  daySelections,
  shootDays,
  allSelected,
  onToggleDay,
  onToggleAll
}: GearDayColumnsProps) {
  const selectionByDay = React.useMemo(() => {
    const m = new Map<string, boolean>();
    for (const d of daySelections) {
      m.set(d.shootDayId, d.selected);
    }
    return m;
  }, [daySelections]);

  return (
    <>
      <td className="p-2 text-center">
        <AllCheckbox
          allSelected={allSelected}
          someSelected={
            selectionByDay.size > 0 &&
            Array.from(selectionByDay.values()).some(Boolean)
          }
          onToggle={onToggleAll}
        />
      </td>
      {shootDays.map((day) => (
        <td key={day.id} className="p-2 text-center" title={day.date}>
          <input
            type="checkbox"
            checked={selectionByDay.get(day.id) ?? true}
            onChange={() => onToggleDay(day.id)}
            className="h-4 w-4 rounded border-input"
          />
        </td>
      ))}
    </>
  );
}
