"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export function SignupForm() {
  const router = useRouter();
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
      router.push(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch {
      setError("Network error");
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-card">
      <div>
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a one-time code to sign in.
        </p>
      </div>
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
          {status === "loading" ? "Sending…" : "Send code"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary underline hover:no-underline">
          Log in
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        By signing up you agree to our{" "}
        <Link href="/terms" className="text-primary underline hover:no-underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-primary underline hover:no-underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
