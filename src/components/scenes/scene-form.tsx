"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createScene, updateScene } from "@/actions/scenes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export type SceneFormValues = {
  sceneNumber: string;
  title: string;
  intExt: string;
  dayNight: string;
  pageCount: string;
  synopsis: string;
  locationId: string;
};

type SceneFormProps = {
  mode: "create" | "edit";
  sceneId?: string;
  defaultValues: SceneFormValues;
  locations: Array<{ id: string; name: string }>;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function SceneForm({
  mode,
  sceneId,
  defaultValues,
  locations,
  onSuccess,
  onCancel,
  submitLabel
}: SceneFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [locationId, setLocationId] = React.useState(
    defaultValues.locationId || ""
  );
  const router = useRouter();

  React.useEffect(() => {
    setLocationId(defaultValues.locationId || "");
  }, [defaultValues.locationId]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("locationId", locationId);
    if (mode === "create") {
      const result = await createScene(formData);
      if (result.error) setError(result.error);
      else {
        router.refresh();
        onSuccess?.();
      }
    } else if (sceneId) {
      const result = await updateScene(sceneId, formData);
      if (result.error) setError(result.error);
      else {
        router.refresh();
        onSuccess?.();
      }
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sceneNumber">Scene number (required)</Label>
        <Input
          id="sceneNumber"
          name="sceneNumber"
          required
          defaultValue={defaultValues.sceneNumber}
          placeholder="e.g. 1, 2A, 14B"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultValues.title}
          placeholder="Scene title"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="intExt">INT/EXT</Label>
          <select
            id="intExt"
            name="intExt"
            defaultValue={defaultValues.intExt || ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">—</option>
            <option value="INT">INT</option>
            <option value="EXT">EXT</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dayNight">DAY/NIGHT</Label>
          <select
            id="dayNight"
            name="dayNight"
            defaultValue={defaultValues.dayNight || ""}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="">—</option>
            <option value="DAY">DAY</option>
            <option value="NIGHT">NIGHT</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pageCount">Page count</Label>
        <Input
          id="pageCount"
          name="pageCount"
          type="number"
          min={0}
          step={0.25}
          defaultValue={defaultValues.pageCount}
          placeholder="e.g. 1.5, 2.75"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="synopsis">Synopsis</Label>
        <textarea
          id="synopsis"
          name="synopsis"
          rows={3}
          defaultValue={defaultValues.synopsis}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="locationId">Location</Label>
        <select
          id="locationId"
          name="locationId"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="">None</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        {locationId && (
          <p className="text-sm">
            <Link
              href={`/production/locations/${locationId}`}
              className="text-primary hover:underline"
            >
              View location →
            </Link>
          </p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit">{submitLabel ?? (mode === "create" ? "Create" : "Save")}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export const defaultSceneFormValues: SceneFormValues = {
  sceneNumber: "",
  title: "",
  intExt: "",
  dayNight: "",
  pageCount: "",
  synopsis: "",
  locationId: ""
};
