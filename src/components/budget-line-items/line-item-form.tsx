"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ReceiptUpload } from "./receipt-upload";
import { createLineItem } from "@/actions/budget-line-items";
import { Plus } from "lucide-react";

export type SourceOption = {
  type: string;
  id: string;
  label: string;
};

type LineItemFormProps = {
  buckets: Array<{ id: string; name: string }>;
  sourceOptions?: SourceOption[];
  onSuccess?: () => void;
};

const defaultDate = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

export function LineItemForm({
  buckets,
  sourceOptions = [],
  onSuccess
}: LineItemFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createLineItem(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    form.reset();
    onSuccess?.();
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Add Line Item
        </Button>
      </DialogTrigger>
      <DialogContent className="">
        <h2 className="mb-4 text-lg font-semibold">Add Line Item</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div>
            <Label htmlFor="bucketId">Bucket *</Label>
            <select
              id="bucketId"
              name="bucketId"
              required
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">Select bucket</option>
              {buckets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              name="description"
              required
              placeholder="e.g. Day 1 Lunch"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="plannedAmount">Planned amount</Label>
              <Input
                id="plannedAmount"
                name="plannedAmount"
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="actualAmount">Actual amount *</Label>
              <Input
                id="actualAmount"
                name="actualAmount"
                type="number"
                min={0}
                step={0.01}
                required
                placeholder="0"
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={defaultDate()}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Optional notes"
            />
          </div>
          <div>
            <Label>Receipt (optional)</Label>
            <ReceiptUpload name="receipt" className="mt-1" />
          </div>
          {sourceOptions.length > 0 && (
            <div>
              <Label htmlFor="sourceLink">Link to source</Label>
              <select
                id="sourceLink"
                name="sourceLink"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                onChange={(e) => {
                  const v = e.target.value;
                  const form = e.target.form;
                  if (!form) return;
                  const typeEl = form.querySelector<HTMLInputElement>("input[name=sourceType]");
                  const idEl = form.querySelector<HTMLInputElement>("input[name=sourceId]");
                  if (typeEl && idEl) {
                    if (!v) {
                      typeEl.value = "";
                      idEl.value = "";
                    } else {
                      const [type, id] = v.split(":");
                      typeEl.value = type ?? "";
                      idEl.value = id ?? "";
                    }
                  }
                }}
              >
                <option value="">None</option>
                {sourceOptions.map((opt) => (
                  <option key={`${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>
                    {opt.label} ({opt.type})
                  </option>
                ))}
              </select>
              <input type="hidden" name="sourceType" />
              <input type="hidden" name="sourceId" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Create"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
