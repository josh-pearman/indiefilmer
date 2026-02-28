"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCraftServicesDefaults } from "@/actions/settings";

type CraftServicesDefaultsFormProps = {
  currencySymbol: string;
  craftyPerPerson: number;
  lunchPerPerson: number;
  dinnerPerPerson: number;
  craftyEnabledByDefault: boolean;
  lunchEnabledByDefault: boolean;
  dinnerEnabledByDefault: boolean;
};

export function CraftServicesDefaultsForm({
  currencySymbol,
  craftyPerPerson: initialCrafty,
  lunchPerPerson: initialLunch,
  dinnerPerPerson: initialDinner,
  craftyEnabledByDefault: initialCraftyEnabled,
  lunchEnabledByDefault: initialLunchEnabled,
  dinnerEnabledByDefault: initialDinnerEnabled
}: CraftServicesDefaultsFormProps) {
  const router = useRouter();
  const [craftyPerPerson, setCraftyPerPerson] = React.useState(String(initialCrafty));
  const [lunchPerPerson, setLunchPerPerson] = React.useState(String(initialLunch));
  const [dinnerPerPerson, setDinnerPerPerson] = React.useState(String(initialDinner));
  const [craftyEnabledByDefault, setCraftyEnabledByDefault] = React.useState(initialCraftyEnabled);
  const [lunchEnabledByDefault, setLunchEnabledByDefault] = React.useState(initialLunchEnabled);
  const [dinnerEnabledByDefault, setDinnerEnabledByDefault] = React.useState(initialDinnerEnabled);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCraftyPerPerson(String(initialCrafty));
    setLunchPerPerson(String(initialLunch));
    setDinnerPerPerson(String(initialDinner));
    setCraftyEnabledByDefault(initialCraftyEnabled);
    setLunchEnabledByDefault(initialLunchEnabled);
    setDinnerEnabledByDefault(initialDinnerEnabled);
  }, [
    initialCrafty,
    initialLunch,
    initialDinner,
    initialCraftyEnabled,
    initialLunchEnabled,
    initialDinnerEnabled
  ]);

  const save = async () => {
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("craftyPerPerson", String(Number(craftyPerPerson) || 0));
    formData.set("lunchPerPerson", String(Number(lunchPerPerson) || 0));
    formData.set("dinnerPerPerson", String(Number(dinnerPerPerson) || 0));
    if (craftyEnabledByDefault) formData.set("craftyEnabledByDefault", "on");
    if (lunchEnabledByDefault) formData.set("lunchEnabledByDefault", "on");
    if (dinnerEnabledByDefault) formData.set("dinnerEnabledByDefault", "on");
    const result = await updateCraftServicesDefaults(formData);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  };

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">
        Per-person cost defaults and whether each meal type is enabled when creating new shoot days.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="craftyPerPerson">Crafty — cost per person ({currencySymbol})</Label>
          <Input
            id="craftyPerPerson"
            type="number"
            min={0}
            step={0.01}
            value={craftyPerPerson}
            onChange={(e) => setCraftyPerPerson(e.target.value)}
            onBlur={save}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={craftyEnabledByDefault}
              onChange={(e) => setCraftyEnabledByDefault(e.target.checked)}
              className="rounded border-border"
            />
            Enabled by default for new shoot days
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lunchPerPerson">Lunch — cost per person ({currencySymbol})</Label>
          <Input
            id="lunchPerPerson"
            type="number"
            min={0}
            step={0.01}
            value={lunchPerPerson}
            onChange={(e) => setLunchPerPerson(e.target.value)}
            onBlur={save}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lunchEnabledByDefault}
              onChange={(e) => setLunchEnabledByDefault(e.target.checked)}
              className="rounded border-border"
            />
            Enabled by default for new shoot days
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dinnerPerPerson">Dinner — cost per person ({currencySymbol})</Label>
          <Input
            id="dinnerPerPerson"
            type="number"
            min={0}
            step={0.01}
            value={dinnerPerPerson}
            onChange={(e) => setDinnerPerPerson(e.target.value)}
            onBlur={save}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dinnerEnabledByDefault}
              onChange={(e) => setDinnerEnabledByDefault(e.target.checked)}
              className="rounded border-border"
            />
            Enabled by default for new shoot days
          </label>
        </div>
      </div>
      <Button onClick={save} disabled={pending} size="sm">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
