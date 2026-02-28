"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createNote } from "@/actions/notes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SUGGESTED_CATEGORIES = [
  "Ideas",
  "Reference",
  "Legal",
  "Equipment",
  "Vendors",
  "Music",
  "Permits",
  "Meeting Notes"
];

export type NoteFormValues = {
  title: string;
  category: string;
  body: string;
};

type NoteFormProps = {
  mode: "create";
  defaultValues: NoteFormValues;
  categories: string[];
  titleRef?: React.Ref<HTMLInputElement>;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function NoteFormCreate({
  defaultValues,
  categories,
  titleRef,
  onSuccess,
  onCancel,
  submitLabel = "Create"
}: NoteFormProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();
  const allCategories = [...new Set([...SUGGESTED_CATEGORIES, ...categories])];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const result = await createNote(formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
        onSuccess?.();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
      <div className="space-y-2">
        <Label htmlFor="note-title">Title (required)</Label>
        <Input
          id="note-title"
          name="title"
          ref={titleRef}
          required
          defaultValue={defaultValues.title}
          placeholder="e.g. Location scouting – downtown loft"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="note-category">Category</Label>
        <Input
          id="note-category"
          name="category"
          list="note-category-list"
          defaultValue={defaultValues.category}
          placeholder="e.g. Reference, Vendors"
          className="w-full"
        />
        <datalist id="note-category-list">
          {allCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note-body">Body</Label>
        <textarea
          id="note-body"
          name="body"
          rows={4}
          defaultValue={defaultValues.body}
          placeholder="Capture your idea, reference, or reminder…"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating..." : submitLabel}
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

export const defaultNoteFormValues: NoteFormValues = {
  title: "",
  category: "",
  body: ""
};
