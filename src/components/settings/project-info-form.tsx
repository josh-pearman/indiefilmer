"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProjectSettings } from "@/actions/settings";

type ProjectInfoFormProps = {
  projectName: string;
  totalBudget: number;
  currencySymbol: string;
};

export function ProjectInfoForm({
  projectName: initialProjectName,
  totalBudget: initialTotalBudget,
  currencySymbol: initialCurrencySymbol
}: ProjectInfoFormProps) {
  const router = useRouter();
  const [projectName, setProjectName] = React.useState(initialProjectName);
  const [totalBudget, setTotalBudget] = React.useState(String(initialTotalBudget));
  const [currencySymbol, setCurrencySymbol] = React.useState(initialCurrencySymbol);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setProjectName(initialProjectName);
    setTotalBudget(String(initialTotalBudget));
    setCurrencySymbol(initialCurrencySymbol);
  }, [initialProjectName, initialTotalBudget, initialCurrencySymbol]);

  const save = async () => {
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("projectName", projectName.trim() || "Untitled Project");
    formData.set("totalBudget", String(Math.max(0, Number(totalBudget.replace(/[^0-9.]/g, "")) || 0)));
    formData.set("currencySymbol", currencySymbol.trim() || "$");
    const result = await updateProjectSettings(formData);
    setPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div>
        <Label htmlFor="projectName">Project Name</Label>
        <Input
          id="projectName"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          onBlur={save}
          placeholder="Untitled Project"
          className="mt-1 max-w-md"
        />
      </div>
      <div>
        <Label htmlFor="totalBudget">Total Project Budget</Label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-muted-foreground">{currencySymbol}</span>
          <Input
            id="totalBudget"
            type="text"
            inputMode="numeric"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value.replace(/[^0-9.]/g, ""))}
            onBlur={save}
            className="max-w-[180px] font-mono"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="currencySymbol">Currency Symbol</Label>
        <Input
          id="currencySymbol"
          value={currencySymbol}
          onChange={(e) => setCurrencySymbol(e.target.value)}
          onBlur={save}
          maxLength={5}
          className="mt-1 max-w-[80px]"
        />
      </div>
      <Button onClick={save} disabled={pending} size="sm">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
