"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateScriptVersion } from "@/actions/script-versions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ScriptVersion = {
  id: string;
  versionName: string;
  pageCount: number | null;
  notes: string | null;
};

type ScriptVersionEditFormProps = {
  version: ScriptVersion;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ScriptVersionEditForm({
  version,
  onSuccess,
  onCancel
}: ScriptVersionEditFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("id", version.id);
    const result = await updateScriptVersion(version.id, formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="id" value={version.id} />
      <div className="space-y-2">
        <Label htmlFor="versionLabel">Version label (required)</Label>
        <Input
          id="versionLabel"
          name="versionLabel"
          required
          defaultValue={version.versionName}
          placeholder="e.g. Draft 2, Pink Revisions"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pageCount">Page count</Label>
        <Input
          id="pageCount"
          name="pageCount"
          type="number"
          min={1}
          defaultValue={version.pageCount ?? ""}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={version.notes ?? ""}
          placeholder="Revision notes..."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
