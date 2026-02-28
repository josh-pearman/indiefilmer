"use client";

import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export type UserOption = { id: string; label: string };

type UserPickerProps = {
  users: UserOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function UserPicker({ users, selectedId, onSelect }: UserPickerProps) {
  if (users.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {users.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 py-4 transition-colors",
            selectedId === id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card hover:border-muted-foreground hover:bg-accent/50"
          )}
        >
          <User className="h-8 w-8" />
          <span className="font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
