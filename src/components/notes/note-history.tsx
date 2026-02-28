"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  before: string | null;
  after: string | null;
  changeNote: string | null;
  performedBy: string | null;
  createdAt: Date;
};

type NoteHistoryProps = {
  entries: AuditEntry[];
  initialVisible?: number;
};

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} minutes ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hours ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} days ago`;
  if (sec < 2592000) return `${Math.floor(sec / 604800)} weeks ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function diffLines(
  before: unknown,
  after: unknown
): Array<{ field: string; from: string; to: string }> {
  if (before == null && after == null) return [];
  const b = typeof before === "object" && before !== null ? (before as Record<string, unknown>) : {};
  const a = typeof after === "object" && after !== null ? (after as Record<string, unknown>) : {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const lines: Array<{ field: string; from: string; to: string }> = [];
  for (const key of keys) {
    if (key === "createdAt" || key === "updatedAt") continue;
    const fromVal = b[key];
    const toVal = a[key];
    const fromStr = fromVal === undefined || fromVal === null ? "—" : String(fromVal);
    const toStr = toVal === undefined || toVal === null ? "—" : String(toVal);
    if (fromStr !== toStr) {
      lines.push({ field: key, from: fromStr, to: toStr });
    }
  }
  return lines;
}

export function NoteHistory({
  entries,
  initialVisible = 20
}: NoteHistoryProps) {
  const [visible, setVisible] = React.useState(initialVisible);
  const shown = entries.slice(0, visible);
  const hasMore = entries.length > visible;

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <p className="text-sm text-muted-foreground">
          Recent changes to this note.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes yet.</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((entry) => {
              let beforeObj: unknown = null;
              let afterObj: unknown = null;
              try {
                if (entry.before) beforeObj = JSON.parse(entry.before);
                if (entry.after) afterObj = JSON.parse(entry.after);
              } catch {
                // ignore
              }
              const lines = diffLines(beforeObj, afterObj);

              return (
                <li
                  key={entry.id}
                  className={cn(
                    "rounded-md border border-border bg-muted/30 p-3 text-sm"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium capitalize">{entry.action}</span>
                    <span className="text-muted-foreground text-xs">
                      {formatRelativeTime(entry.createdAt)}
                      {entry.performedBy && ` · ${entry.performedBy}`}
                    </span>
                  </div>
                  {entry.changeNote && (
                    <p className="mt-1 text-muted-foreground">
                      {entry.changeNote}
                    </p>
                  )}
                  {lines.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                      {lines.map(({ field, from, to }) => (
                        <li key={field}>
                          <span className="text-muted-foreground">{field}:</span>{" "}
                          <span className="line-through">{from}</span> →{" "}
                          <span>{to}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setVisible((v) => v + 20)}
          >
            Show more
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
