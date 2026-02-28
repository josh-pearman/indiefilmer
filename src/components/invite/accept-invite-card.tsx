"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/actions/invites";

interface AcceptInviteCardProps {
  token: string;
  email: string;
  role: string;
  projectName: string;
  expired: boolean;
  accepted: boolean;
}

export function AcceptInviteCard({
  token,
  email,
  role,
  projectName,
  expired,
  accepted
}: AcceptInviteCardProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const [error, setError] = React.useState<string | null>(null);

  if (expired) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-center">
        <h1 className="text-xl font-semibold">Invite expired</h1>
        <p className="text-sm text-muted-foreground">
          This invite has expired. Ask the project admin to send a new one.
        </p>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-center">
        <h1 className="text-xl font-semibold">Already accepted</h1>
        <p className="text-sm text-muted-foreground">
          This invite has already been accepted.
        </p>
      </div>
    );
  }

  async function handleAccept() {
    setStatus("loading");
    setError(null);
    const result = await acceptInvite(token);
    if (result.error) {
      setError(result.error);
      setStatus("error");
    } else {
      setStatus("done");
      router.push("/");
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-card">
      <div>
        <h1 className="text-xl font-semibold">You&apos;re invited!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve been invited to join{" "}
          <strong>{projectName}</strong> as a{" "}
          <strong>{role}</strong>.
        </p>
      </div>
      <div className="rounded-md border border-border bg-muted/50 p-4 space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">Project:</span>{" "}
          <span className="font-medium">{projectName}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Role:</span>{" "}
          <span className="font-medium capitalize">{role}</span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Email:</span>{" "}
          <span className="font-medium">{email}</span>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={handleAccept}
        className="w-full"
        disabled={status === "loading" || status === "done"}
      >
        {status === "loading"
          ? "Accepting..."
          : status === "done"
            ? "Accepted!"
            : "Accept invite"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By accepting, an account will be created for {email} if one
        doesn&apos;t exist.
      </p>
    </div>
  );
}
