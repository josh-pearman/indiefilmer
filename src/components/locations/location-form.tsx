"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createLocation, updateLocation } from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";

const STATUSES = [
  "Shortlist",
  "Contacted",
  "Visited",
  "On Hold",
  "Booked",
  "Rejected"
] as const;
const PROVIDERS = ["Peerspace", "Giggster", "Other"] as const;

export type LocationFormValues = {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  providerType: string;
  providerLink: string;
  status: string;
  estimatedCostPerDay: string;
  numberOfDays: string;
  fees: string;
  costNotes: string;
  plannedAmount: string;
  notes: string;
};

type LocationFormProps = {
  mode: "create" | "edit";
  locationId?: string;
  defaultValues: LocationFormValues;
  /** When true, address field uses Google Maps autocomplete and stores lat/lng */
  autocompleteEnabled?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  afterProviderLink?: React.ReactNode;
};

export function LocationForm({
  mode,
  locationId,
  defaultValues,
  autocompleteEnabled = false,
  onSuccess,
  onCancel,
  submitLabel,
  afterProviderLink
}: LocationFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      if (mode === "create") {
        const result = await createLocation(formData);
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      } else if (locationId) {
        const result = await updateLocation(locationId, formData);
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
        <Label htmlFor="name">Name (required)</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues.name}
          placeholder="Location name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <AddressAutocomplete
          defaultAddress={defaultValues.address}
          defaultLatitude={defaultValues.latitude}
          defaultLongitude={defaultValues.longitude}
          name="address"
          nameLatitude="latitude"
          nameLongitude="longitude"
          autocompleteEnabled={autocompleteEnabled}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Provider type</Label>
        <div className="flex gap-4">
          {PROVIDERS.map((p) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="providerType"
                value={p}
                defaultChecked={defaultValues.providerType === p}
                className="rounded border-border"
              />
              {p}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="providerLink">Provider link (URL)</Label>
        <Input
          id="providerLink"
          name="providerLink"
          type="url"
          defaultValue={defaultValues.providerLink}
          placeholder="https://..."
        />
        {defaultValues.providerLink && (
          <a
            href={defaultValues.providerLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open link →
          </a>
        )}
      </div>
      {afterProviderLink}
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
      <fieldset className="space-y-4 rounded-md border border-border p-4">
        <legend className="px-2 text-sm font-semibold">Cost &amp; Budget</legend>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planned Budget</p>
          <p className="text-xs text-muted-foreground">Your target allocation for this location.</p>
          <div className="max-w-[12rem]">
            <Label htmlFor="plannedAmount" className="sr-only">Planned budget</Label>
            <Input
              id="plannedAmount"
              name="plannedAmount"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 2000"
              defaultValue={defaultValues.plannedAmount}
            />
          </div>
        </div>

        <hr className="border-border/60" />

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost Estimate</p>
          <p className="text-xs text-muted-foreground">The committed amount — cost per day × days + fees.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="estimatedCostPerDay">Cost per day ($)</Label>
              <Input
                id="estimatedCostPerDay"
                name="estimatedCostPerDay"
                type="number"
                min={0}
                step={0.01}
                defaultValue={defaultValues.estimatedCostPerDay}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfDays">Number of days</Label>
              <Input
                id="numberOfDays"
                name="numberOfDays"
                type="number"
                min={0}
                step={1}
                defaultValue={defaultValues.numberOfDays}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees">Fees ($)</Label>
              <Input
                id="fees"
                name="fees"
                type="number"
                min={0}
                step={0.01}
                defaultValue={defaultValues.fees}
              />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="costNotes">Cost notes</Label>
            <textarea
              id="costNotes"
              name="costNotes"
              rows={2}
              defaultValue={defaultValues.costNotes}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
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

export const defaultLocationFormValues: LocationFormValues = {
  name: "",
  address: "",
  latitude: null,
  longitude: null,
  providerType: "",
  providerLink: "",
  status: "Shortlist",
  estimatedCostPerDay: "",
  numberOfDays: "",
  fees: "",
  costNotes: "",
  plannedAmount: "",
  notes: ""
};
