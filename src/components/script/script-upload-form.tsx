"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createScriptVersion } from "@/actions/script-versions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.fdx,.fountain,.txt,.docx";

export type ScriptUploadFormValues = {
  versionLabel: string;
  pageCount: string;
  notes: string;
  setAsCurrent: boolean;
};

export const defaultScriptUploadFormValues: ScriptUploadFormValues = {
  versionLabel: "",
  pageCount: "",
  notes: "",
  setAsCurrent: true
};

type ScriptUploadFormProps = {
  defaultValues: ScriptUploadFormValues;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function ScriptUploadForm({
  defaultValues,
  onSuccess,
  onCancel
}: ScriptUploadFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (file) formData.set("file", file);
    const result = await createScriptVersion(formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onSuccess?.();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">File (required)</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept={ACCEPT}
          required
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm",
            "file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground file:text-sm"
          )}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Allowed: PDF, FDX, Fountain, TXT, DOCX
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="versionLabel">Version label (required)</Label>
        <Input
          id="versionLabel"
          name="versionLabel"
          required
          defaultValue={defaultValues.versionLabel}
          placeholder="e.g. Draft 2, Pink Revisions, Table Read Draft"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pageCount">Page count</Label>
        <Input
          id="pageCount"
          name="pageCount"
          type="number"
          min={1}
          defaultValue={defaultValues.pageCount}
          placeholder="Optional"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues.notes}
          placeholder="Revision notes, what changed..."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="setAsCurrent"
          name="setAsCurrent"
          type="checkbox"
          defaultChecked={defaultValues.setAsCurrent}
          value="on"
          className="rounded border-border"
        />
        <Label htmlFor="setAsCurrent" className="font-normal">
          Set as current draft
        </Label>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit">Upload</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
