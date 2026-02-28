"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateLineItem,
  deleteLineItem,
  restoreLineItem,
  rollbackLineItem
} from "@/actions/budget-line-items";
import { Undo2, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type LineItemRowData = {
  id: string;
  bucketId: string;
  bucketName: string;
  description: string;
  plannedAmount: number | null;
  actualAmount: number;
  date: string | null;
  notes: string | null;
  receiptPath: string | null;
  isDeleted: boolean;
};

type LineItemRowProps = {
  item: LineItemRowData;
  buckets: Array<{ id: string; name: string }>;
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "2-digit"
  });
}

export function LineItemRow({ item, buckets }: LineItemRowProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [rollbackPending, setRollbackPending] = React.useState(false);
  const [form, setForm] = React.useState({
    description: item.description,
    plannedAmount: item.plannedAmount ?? "",
    actualAmount: item.actualAmount,
    date: item.date ? item.date.slice(0, 10) : "",
    notes: item.notes ?? "",
    bucketId: item.bucketId
  });

  React.useEffect(() => {
    setForm({
      description: item.description,
      plannedAmount: item.plannedAmount ?? "",
      actualAmount: item.actualAmount,
      date: item.date ? item.date.slice(0, 10) : "",
      notes: item.notes ?? "",
      bucketId: item.bucketId
    });
  }, [item]);

  const save = async () => {
    setPending(true);
    const formData = new FormData();
    formData.set("description", form.description);
    formData.set("actualAmount", String(form.actualAmount));
    formData.set("date", form.date || new Date().toISOString().slice(0, 10));
    formData.set("notes", form.notes);
    formData.set("bucketId", form.bucketId);
    if (form.plannedAmount !== "" && form.plannedAmount !== null) {
      formData.set("plannedAmount", String(form.plannedAmount));
    }
    await updateLineItem(item.id, formData);
    setPending(false);
    setEditing(false);
    router.refresh();
  };

  const handleDelete = async () => {
    setPending(true);
    await deleteLineItem(item.id);
    setPending(false);
    router.refresh();
  };

  const handleRestore = async () => {
    setPending(true);
    await restoreLineItem(item.id);
    setPending(false);
    router.refresh();
  };

  const handleRollback = async () => {
    setRollbackPending(true);
    await rollbackLineItem(item.id);
    setRollbackPending(false);
    router.refresh();
  };

  if (item.isDeleted) {
    return (
      <tr className="bg-muted/40">
        <td colSpan={7} className="py-2 pr-4 text-sm text-muted-foreground">
          <span className="italic">{item.description}</span> (deleted)
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-2 h-7"
            onClick={handleRestore}
            disabled={pending}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Restore
          </Button>
        </td>
      </tr>
    );
  }

  if (editing) {
    return (
      <tr className="border-b border-border/60">
        <td className="py-1 pr-4">
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className="h-8 text-sm"
          />
        </td>
        <td className="py-1 pr-4">
          <select
            value={form.bucketId}
            onChange={(e) =>
              setForm((f) => ({ ...f, bucketId: e.target.value }))
            }
            className="h-8 w-full max-w-[120px] rounded border border-input bg-transparent px-2 text-sm"
          >
            {buckets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </td>
        <td className="py-1 pr-4">
          <Input
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            className="h-8 text-sm"
          />
        </td>
        <td className="py-1 pr-4">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.plannedAmount}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                plannedAmount: e.target.value === "" ? "" : Number(e.target.value)
              }))
            }
            className="h-8 w-20 font-mono text-sm"
          />
        </td>
        <td className="py-1 pr-4">
          <Input
            type="number"
            min={0}
            step={0.01}
            value={form.actualAmount}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                actualAmount: Number(e.target.value) || 0
              }))
            }
            className="h-8 w-20 font-mono text-sm"
          />
        </td>
        <td className="py-1 pr-4">
          <Input
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            className="h-8 text-sm"
          />
        </td>
        <td className="py-1">
          <div className="flex items-center gap-1">
            {item.receiptPath && (
              <a
                href={`/api/receipts/${encodeURIComponent(item.receiptPath)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs hover:underline"
              >
                📎 View
              </a>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={save}
              disabled={pending}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/60">
      <td className="py-2 pr-4 text-sm tabular-nums">
        {formatDate(item.date)}
      </td>
      <td className="py-2 pr-4 text-sm">{item.bucketName}</td>
      <td className="py-2 pr-4 text-sm">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left hover:underline"
        >
          {item.description}
        </button>
      </td>
      <td className="py-2 pr-4 text-right text-sm tabular-nums">
        {item.plannedAmount != null
          ? `$${item.plannedAmount.toLocaleString()}`
          : "—"}
      </td>
      <td className="py-2 pr-4 text-right text-sm tabular-nums">
        ${item.actualAmount.toLocaleString()}
      </td>
      <td className="py-2 pr-4 text-sm text-muted-foreground max-w-[120px] truncate">
        {item.notes || "—"}
      </td>
      <td className="py-2">
        <div className="flex items-center gap-1">
          {item.receiptPath ? (
            <a
              href={`/api/receipts/${encodeURIComponent(item.receiptPath)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs hover:underline"
            >
              📎 View
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleRollback}
            disabled={rollbackPending}
            title="Undo last change"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={pending}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
