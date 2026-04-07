"use client";

import * as React from "react";
import { createInvite, type InviteState } from "@/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InviteState = {};

export function InviteForm() {
  const [state, formAction] = React.useActionState(createInvite, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="invite-email">Email address</Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="collaborator@example.com"
            className="max-w-xs"
          />
          <input type="hidden" name="role" value="collaborator" />
          <Button type="submit">Send invite</Button>
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 dark:text-green-400">{state.success}</p>
      )}
    </form>
  );
}
