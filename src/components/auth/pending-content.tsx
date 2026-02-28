"use client";

import { logout } from "@/actions/auth";

export function PendingContent() {
  return (
    <>
      <h1 className="text-xl font-semibold">Account pending</h1>
      <p className="max-w-sm text-center text-muted-foreground">
        Your account is awaiting approval. An administrator will review it shortly.
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="text-sm text-primary underline hover:no-underline"
        >
          Log out
        </button>
      </form>
    </>
  );
}
