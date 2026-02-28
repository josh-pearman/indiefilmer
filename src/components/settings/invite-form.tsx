"use client";

import * as React from "react";
import { createInvite, type InviteState } from "@/actions/invites";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SECTION_KEYS, SECTION_LABELS } from "@/lib/sections";

const initialState: InviteState = {};

export function InviteForm() {
  const [state, formAction] = React.useActionState(createInvite, initialState);
  const [role, setRole] = React.useState<"admin" | "collaborator">("collaborator");

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email address</Label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="collaborator@example.com"
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        />
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              value="admin"
              checked={role === "admin"}
              onChange={() => setRole("admin")}
            />
            Admin (full access)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              value="collaborator"
              checked={role === "collaborator"}
              onChange={() => setRole("collaborator")}
            />
            Collaborator (section access)
          </label>
        </div>
      </div>
      {role === "collaborator" && (
        <div className="space-y-2">
          <Label>Sections</Label>
          <p className="text-xs text-muted-foreground">
            Select which sections this collaborator can access.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            {SECTION_KEYS.filter((k) => k !== "settings").map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" name={`section-${key}`} value="on" />
                <span className="text-sm">{SECTION_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      <Button type="submit">Send invite</Button>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">{state.success}</p>
      )}
    </form>
  );
}
