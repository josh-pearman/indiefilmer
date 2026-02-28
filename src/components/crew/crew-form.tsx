"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createCrewMember, updateCrewMember } from "@/actions/crew";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const POSITION_SUGGESTIONS = [
  "DP",
  "Sound Mixer",
  "Gaffer",
  "Grip",
  "PA",
  "Makeup",
  "Wardrobe",
  "Script Supervisor",
  "1st AD",
  "2nd AD",
  "Production Designer",
  "Editor",
  "Colorist",
  "Composer",
  "VFX Artist",
  "Stills Photographer"
];

const STATUSES = ["Confirmed", "Pending", "TBD"] as const;

export type CrewFormValues = {
  name: string;
  position: string;
  phone: string;
  email: string;
  includePhoneOnCallSheet: boolean;
  includeEmailOnCallSheet: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  dietaryRestrictions: string;
  status: string;
  notes: string;
  rate: string;
  days: string;
  flatFee: string;
  plannedAmount: string;
};

type CrewFormProps = {
  mode: "create" | "edit";
  crewId?: string;
  defaultValues: CrewFormValues;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function CrewForm({
  mode,
  crewId,
  defaultValues,
  onSuccess,
  onCancel,
  submitLabel
}: CrewFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      if (mode === "create") {
        const result = await createCrewMember(formData);
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      } else if (crewId) {
        const result = await updateCrewMember(crewId, formData);
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4" aria-busy={pending}>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultValues.name}
          placeholder="Full name (optional — leave blank for unfilled positions)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position">Position (required)</Label>
        <Input
          id="position"
          name="position"
          required
          defaultValue={defaultValues.position}
          placeholder="e.g. DP, Sound, Gaffer"
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        {showSuggestions && (
          <div className="rounded-md border border-border bg-muted/50 p-2 text-sm">
            <p className="text-muted-foreground mb-1">Suggestions:</p>
            <div className="flex flex-wrap gap-1">
              {POSITION_SUGGESTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("position") as HTMLInputElement;
                    if (el) el.value = p;
                  }}
                  className="rounded bg-background px-2 py-0.5 hover:bg-accent"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues.status}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaultValues.phone}
            placeholder="Phone number"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="includePhoneOnCallSheet"
              defaultChecked={defaultValues.includePhoneOnCallSheet}
              value="on"
              className="rounded border-border"
            />
            Include phone on call sheet
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={defaultValues.email}
            placeholder="Email address"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="includeEmailOnCallSheet"
              defaultChecked={defaultValues.includeEmailOnCallSheet}
              value="on"
              className="rounded border-border"
            />
            Include email on call sheet
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Emergency contact</Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="crewEmergencyContactName" className="text-xs">Name</Label>
            <Input
              id="crewEmergencyContactName"
              name="emergencyContactName"
              defaultValue={defaultValues.emergencyContactName}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crewEmergencyContactRelation" className="text-xs">Relationship</Label>
            <Input
              id="crewEmergencyContactRelation"
              name="emergencyContactRelation"
              defaultValue={defaultValues.emergencyContactRelation}
              placeholder="e.g. Spouse, Parent"
              list="crewEmergencyRelationList"
            />
            <datalist id="crewEmergencyRelationList">
              {["Spouse", "Partner", "Parent", "Sibling", "Friend", "Other"].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="crewEmergencyContactPhone" className="text-xs">Phone</Label>
          <Input
            id="crewEmergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            defaultValue={defaultValues.emergencyContactPhone}
            placeholder="555-0000"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="crewDietaryRestrictions">Dietary restrictions</Label>
        <Input
          id="crewDietaryRestrictions"
          name="dietaryRestrictions"
          defaultValue={defaultValues.dietaryRestrictions}
          placeholder="e.g., Vegetarian, Gluten-free, Nut allergy"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaultValues.notes}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <fieldset className="space-y-4 rounded-md border border-border p-4">
        <legend className="px-2 text-sm font-semibold">Cost &amp; Budget</legend>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planned Budget</p>
          <p className="text-xs text-muted-foreground">Your target allocation for this crew member.</p>
          <div className="max-w-[12rem]">
            <Label htmlFor="plannedAmount" className="sr-only">Planned budget</Label>
            <Input
              id="plannedAmount"
              name="plannedAmount"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 3000"
              defaultValue={defaultValues.plannedAmount}
            />
          </div>
        </div>

        <hr className="border-border/60" />

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost Estimate</p>
          <p className="text-xs text-muted-foreground">The committed amount — uses flat fee if set, otherwise rate × days.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rate">Rate ($/day)</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                min={0}
                step={0.01}
                defaultValue={defaultValues.rate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="days">Days</Label>
              <Input
                id="days"
                name="days"
                type="number"
                min={0}
                step={0.5}
                defaultValue={defaultValues.days}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flatFee">Flat fee ($)</Label>
              <Input
                id="flatFee"
                name="flatFee"
                type="number"
                min={0}
                step={0.01}
                defaultValue={defaultValues.flatFee}
              />
            </div>
          </div>
        </div>
      </fieldset>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? (mode === "create" ? "Creating..." : "Saving...")
            : (submitLabel ?? (mode === "create" ? "Create" : "Save"))}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export const defaultCrewFormValues: CrewFormValues = {
  name: "",
  position: "",
  phone: "",
  email: "",
  includePhoneOnCallSheet: true,
  includeEmailOnCallSheet: true,
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  dietaryRestrictions: "",
  status: "TBD",
  notes: "",
  rate: "",
  days: "",
  flatFee: "",
  plannedAmount: ""
};
