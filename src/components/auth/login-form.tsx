"use client";

import * as React from "react";
import { login, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

const initialState: LoginState = {
  error: undefined
};

type LoginFormProps = {
  authMode: "password" | "email";
};

export function LoginForm({ authMode }: LoginFormProps) {
  const [state, formAction] = React.useActionState(login, initialState);

  if (authMode === "email") {
    return (
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-card">
        <div>
          <h1 className="text-xl font-semibold">Sign in to indieFilmer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We&apos;re currently only accepting pre-approved emails. Enter yours below to receive a login code.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Want access? Email{" "}
            <a href="mailto:josh@indiefilmer.win" className="text-primary underline hover:no-underline">
              josh@indiefilmer.win
            </a>{" "}
            to request an invite.
          </p>
        </div>
        <EmailLoginForm />
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-card"
    >
      <div>
        <h1 className="text-xl font-semibold">Sign in to indieFilmer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your username and password.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" className="w-full">
        Log In
      </Button>
    </form>
  );
}

function EmailLoginForm() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send code");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Check your inbox for the 6-digit code, then enter it below.
        </p>
        <Link
          href={`/verify?email=${encodeURIComponent(email)}`}
          className="block"
        >
          <Button className="w-full">Enter code</Button>
        </Link>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-sm text-muted-foreground underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          disabled={status === "loading"}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? "Sending…" : "Send login code"}
      </Button>
    </form>
  );
}
