"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  addLocationVenue,
  removeLocationVenue,
  selectLocationVenue,
  updateLocationVenue,
} from "@/actions/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { LocationAttachments } from "@/components/locations/location-attachments";
import { cn } from "@/lib/utils";

type VenueRow = {
  id: string;
  label: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  providerType: string | null;
  providerLink: string | null;
  estimatedCostPerDay: number | null;
  numberOfDays: number | null;
  fees: number | null;
  costNotes: string | null;
  notes: string | null;
};

type LocationVenuesEditorProps = {
  locationId: string;
  venues: VenueRow[];
  selectedVenueId: string | null;
  files: Array<{ id: string; fileName: string; filePath: string; venueId: string | null }>;
  autocompleteEnabled?: boolean;
};

const PROVIDERS = ["Peerspace", "Giggster", "Other"] as const;

export function LocationVenuesEditor({
  locationId,
  venues,
  selectedVenueId,
  files,
  autocompleteEnabled = false,
}: LocationVenuesEditorProps) {
  const router = useRouter();
  const [activeVenueId, setActiveVenueId] = React.useState(
    selectedVenueId ?? venues[0]?.id ?? null
  );
  const [saving, setSaving] = React.useState(false);
  const [switching, setSwitching] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setActiveVenueId(selectedVenueId ?? venues[0]?.id ?? null);
  }, [selectedVenueId, venues]);

  const activeVenue =
    venues.find((venue) => venue.id === activeVenueId) ?? venues[0] ?? null;
  const activeVenueFiles = activeVenue
    ? files.filter((file) => file.venueId === activeVenue.id)
    : [];

  async function handleAddVenue() {
    setError(null);
    setAdding(true);
    const result = await addLocationVenue(locationId);
    setAdding(false);
    if (result.error) setError(result.error);
    router.refresh();
  }

  async function handleSelectVenue(venueId: string) {
    setError(null);
    setActiveVenueId(venueId);
    if (venueId === selectedVenueId) return;
    setSwitching(true);
    const result = await selectLocationVenue(locationId, venueId);
    setSwitching(false);
    if (result.error) setError(result.error);
    router.refresh();
  }

  async function handleSave(formData: FormData) {
    if (!activeVenue) return;
    setError(null);
    setSaving(true);
    const result = await updateLocationVenue(locationId, activeVenue.id, formData);
    setSaving(false);
    if (result.error) setError(result.error);
    router.refresh();
  }

  async function handleRemoveVenue() {
    if (!activeVenue) return;
    setError(null);
    setRemoving(true);
    const result = await removeLocationVenue(locationId, activeVenue.id);
    setRemoving(false);
    if (result.error) setError(result.error);
    router.refresh();
  }

  if (!activeVenue) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">No venues yet.</p>
        <Button type="button" variant="outline" size="sm" onClick={handleAddVenue} disabled={adding}>
          {adding ? "Adding…" : "Add Venue"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {venues.map((venue) => {
          const isActive = venue.id === activeVenue.id;
          const isSelected = venue.id === selectedVenueId;
          return (
            <button
              key={venue.id}
              type="button"
              onClick={() => handleSelectVenue(venue.id)}
              disabled={switching}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted",
                switching && "opacity-70"
              )}
            >
              {venue.label}
              {isSelected ? " *" : ""}
            </button>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddVenue}
          disabled={adding}
        >
          {adding ? "Adding…" : "Add Venue"}
        </Button>
      </div>

      <form key={activeVenue.id} action={handleSave} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2 flex-1">
            <Label htmlFor={`venue-label-${activeVenue.id}`}>Venue Label</Label>
            <Input
              id={`venue-label-${activeVenue.id}`}
              name="label"
              defaultValue={activeVenue.label}
              placeholder="Venue label"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            {activeVenue.id !== selectedVenueId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSelectVenue(activeVenue.id)}
                disabled={switching}
              >
                Use This Venue
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                Selected for budget, scenes, and schedule
              </span>
            )}
            {venues.length > 1 ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemoveVenue}
                disabled={removing}
              >
                {removing ? "Removing…" : "Remove"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`venue-address-${activeVenue.id}`}>Address</Label>
          <AddressAutocomplete
            defaultAddress={activeVenue.address ?? ""}
            defaultLatitude={activeVenue.latitude}
            defaultLongitude={activeVenue.longitude}
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
            {PROVIDERS.map((provider) => (
              <label key={provider} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="providerType"
                  value={provider}
                  defaultChecked={activeVenue.providerType === provider}
                  className="rounded border-border"
                />
                {provider}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`venue-provider-link-${activeVenue.id}`}>Provider link (URL)</Label>
          <Input
            id={`venue-provider-link-${activeVenue.id}`}
            name="providerLink"
            type="url"
            defaultValue={activeVenue.providerLink ?? ""}
            placeholder="https://..."
          />
          {activeVenue.providerLink ? (
            <a
              href={activeVenue.providerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Open link →
            </a>
          ) : null}
        </div>

        <div className="border-t border-border pt-4">
          <LocationAttachments
            locationId={locationId}
            venueId={activeVenue.id}
            files={activeVenueFiles}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`venue-notes-${activeVenue.id}`}>Notes</Label>
          <textarea
            id={`venue-notes-${activeVenue.id}`}
            name="notes"
            rows={2}
            defaultValue={activeVenue.notes ?? ""}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 text-sm font-medium">Cost Estimate</legend>
          <p className="text-xs text-muted-foreground">
            The venue&apos;s cost fields. When this venue is selected, these drive the location&apos;s estimated cost.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor={`venue-estimated-${activeVenue.id}`}>Cost per day ($)</Label>
              <Input
                id={`venue-estimated-${activeVenue.id}`}
                name="estimatedCostPerDay"
                type="number"
                min={0}
                step={0.01}
                defaultValue={
                  activeVenue.estimatedCostPerDay != null
                    ? String(activeVenue.estimatedCostPerDay)
                    : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`venue-days-${activeVenue.id}`}>Number of days</Label>
              <Input
                id={`venue-days-${activeVenue.id}`}
                name="numberOfDays"
                type="number"
                min={0}
                step={1}
                defaultValue={
                  activeVenue.numberOfDays != null ? String(activeVenue.numberOfDays) : ""
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`venue-fees-${activeVenue.id}`}>Fees ($)</Label>
              <Input
                id={`venue-fees-${activeVenue.id}`}
                name="fees"
                type="number"
                min={0}
                step={0.01}
                defaultValue={activeVenue.fees != null ? String(activeVenue.fees) : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`venue-cost-notes-${activeVenue.id}`}>Cost notes</Label>
            <textarea
              id={`venue-cost-notes-${activeVenue.id}`}
              name="costNotes"
              rows={2}
              defaultValue={activeVenue.costNotes ?? ""}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </fieldset>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Venue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
