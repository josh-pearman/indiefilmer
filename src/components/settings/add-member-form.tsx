"use client";

import * as React from "react";
import { addMember, type TeamState } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: TeamState = {};

export function AddMemberForm() {
  const [state, formAction] = React.useActionState(addMember, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" type="text" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" type="text" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={12} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="siteRole">Role</Label>
        <select
          id="siteRole"
          name="siteRole"
          className="flex h-9 w-[140px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="user">User</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </div>
      <Button type="submit">Add member</Button>
      {state.error && (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="w-full text-sm text-green-600 dark:text-green-400">{state.success}</p>
      )}
    </form>
  );
}
