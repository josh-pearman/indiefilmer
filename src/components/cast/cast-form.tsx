"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createCastMember, updateCastMember } from "@/actions/cast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = ["Confirmed", "Pending", "Backup", "TBD"] as const;

export type CastFormValues = {
  name: string;
  roleName: string;
  actorName: string;
  castingLink: string;
  status: string;
  phone: string;
  email: string;
  includePhoneOnCallSheet: boolean;
  includeEmailOnCallSheet: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  dietaryRestrictions: string;
  notes: string;
  rate: string;
  days: string;
  flatFee: string;
  plannedAmount: string;
};

type CastFormProps = {
  mode: "create" | "edit";
  castId?: string;
  defaultValues: CastFormValues;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function CastForm({
  mode,
  castId,
  defaultValues,
  onSuccess,
  onCancel,
  submitLabel
}: CastFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setPending(true);
    try {
      if (mode === "create") {
        const result = await createCastMember(formData);
        if (result.error) setError(result.error);
        else {
          router.refresh();
          onSuccess?.();
        }
      } else if (castId) {
        const result = await updateCastMember(castId, formData);
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
        <Label htmlFor="name">Role (required)</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues.name}
          placeholder="Character name, e.g. EMERSON"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="roleName">Role Description</Label>
        <Input
          id="roleName"
          name="roleName"
          defaultValue={defaultValues.roleName}
          placeholder="e.g. Lead - motel night clerk, introspective and principled"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="actorName">Actor/Actress</Label>
        <Input
          id="actorName"
          name="actorName"
          defaultValue={defaultValues.actorName}
          placeholder="Enter actor/actress name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="castingLink">Casting link (URL)</Label>
        <Input
          id="castingLink"
          name="castingLink"
          type="url"
          defaultValue={defaultValues.castingLink}
          placeholder="https://..."
        />
        {defaultValues.castingLink && (
          <a
            href={defaultValues.castingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Open link
          </a>
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
            <Label htmlFor="emergencyContactName" className="text-xs">Name</Label>
            <Input
              id="emergencyContactName"
              name="emergencyContactName"
              defaultValue={defaultValues.emergencyContactName}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactRelation" className="text-xs">Relationship</Label>
            <Input
              id="emergencyContactRelation"
              name="emergencyContactRelation"
              defaultValue={defaultValues.emergencyContactRelation}
              placeholder="e.g. Spouse, Parent"
              list="emergencyRelationList"
            />
            <datalist id="emergencyRelationList">
              {["Spouse", "Partner", "Parent", "Sibling", "Friend", "Other"].map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyContactPhone" className="text-xs">Phone</Label>
          <Input
            id="emergencyContactPhone"
            name="emergencyContactPhone"
            type="tel"
            defaultValue={defaultValues.emergencyContactPhone}
            placeholder="555-0000"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dietaryRestrictions">Dietary restrictions</Label>
        <Input
          id="dietaryRestrictions"
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
          <p className="text-xs text-muted-foreground">Your target allocation for this cast member.</p>
          <div className="max-w-[12rem]">
            <Label htmlFor="plannedAmount" className="sr-only">Planned budget</Label>
            <Input
              id="plannedAmount"
              name="plannedAmount"
              type="number"
              min={0}
              step={0.01}
              placeholder="e.g. 5000"
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

export const defaultCastFormValues: CastFormValues = {
  name: "",
  roleName: "",
  actorName: "",
  castingLink: "",
  status: "TBD",
  phone: "",
  email: "",
  includePhoneOnCallSheet: true,
  includeEmailOnCallSheet: true,
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
  dietaryRestrictions: "",
  notes: "",
  rate: "",
  days: "",
  flatFee: "",
  plannedAmount: ""
};
