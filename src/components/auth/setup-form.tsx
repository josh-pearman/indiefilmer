"use client";

import * as React from "react";
import { createFirstUser, type SetupState } from "@/actions/setup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: SetupState = { error: undefined };

export function SetupForm() {
  const [state, formAction] = React.useActionState(createFirstUser, initialState);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-card"
    >
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;re the first user. Set up the admin account.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="e.g. admin"
          required
        />
        <p className="text-xs text-muted-foreground">
          Letters, numbers, _ and - only. Used to sign in.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="w-full">
        Create account
      </Button>
    </form>
  );
}
