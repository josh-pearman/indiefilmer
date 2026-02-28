"use client";

import * as React from "react";
import { verifyCode, type VerifyState } from "@/actions/email-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: VerifyState = {};

export function VerifyForm({ email }: { email: string }) {
  const [state, formAction] = React.useActionState(verifyCode, initialState);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-card"
    >
      <div>
        <h1 className="text-xl font-semibold">Enter your code</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a 6-digit code to your email. Enter it below.
        </p>
      </div>

      <input type="hidden" name="email" value={email} readOnly />

      <div className="space-y-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="000000"
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="w-full">
        Verify
      </Button>
    </form>
  );
}
