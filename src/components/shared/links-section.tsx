"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

export type LinkItem = {
  id: string;
  label: string;
  url: string;
};

type LinksSectionProps = {
  items: LinkItem[];
  onAdd: (label: string, url: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

export function LinksSection({ items, onAdd, onRemove }: LinksSectionProps) {
  const [adding, setAdding] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel || !trimmedUrl) return;
    setPending(true);
    await onAdd(trimmedLabel, trimmedUrl);
    setPending(false);
    setLabel("");
    setUrl("");
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Links</span>
        {!adding ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setAdding(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Add Link
          </Button>
        ) : null}
      </div>
      {adding && (
        <form onSubmit={handleAdd} className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
          <div>
            <Label htmlFor="link-label" className="text-xs">Label</Label>
            <Input
              id="link-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Display name"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="link-url" className="text-xs">URL</Label>
            <Input
              id="link-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || !label.trim() || !url.trim()}>
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(false);
                setLabel("");
                setUrl("");
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{item.label}</span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-xs text-muted-foreground hover:underline"
                >
                  {item.url}
                </a>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.label}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
