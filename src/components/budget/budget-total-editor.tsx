"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { updateTotalBudget } from "@/actions/budget";

type BudgetTotalEditorProps = {
  totalBudget: number;
  currencySymbol?: string;
  onUpdate?: () => void;
};

export function BudgetTotalEditor({
  totalBudget,
  currencySymbol = "$",
  onUpdate
}: BudgetTotalEditorProps) {
  const router = useRouter();
  const [value, setValue] = React.useState(String(totalBudget));
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setValue(String(totalBudget));
  }, [totalBudget]);

  const handleBlur = () => {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(n) || n < 0) {
      setValue(String(totalBudget));
      return;
    }
    if (Math.round(n) === Math.round(totalBudget)) return;
    setPending(true);
    updateTotalBudget(Math.round(n)).then(() => {
      setPending(false);
      onUpdate?.();
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Total Project Budget:</span>
      <span className="text-muted-foreground">{currencySymbol}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={handleBlur}
        disabled={pending}
        className="w-28 font-mono"
      />
    </div>
  );
}
