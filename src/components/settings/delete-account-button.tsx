"use client";

import * as React from "react";
import { deleteMyAccount } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteAccountButton() {
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteMyAccount(confirmation);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  if (!showConfirm) {
    return (
      <Button
        type="button"
        variant="destructive"
        className="w-full justify-center"
        onClick={() => setShowConfirm(true)}
      >
        Delete my account
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This will permanently delete your account and remove you from all
        projects. This action cannot be undone.
      </p>
      <div className="space-y-2">
        <label htmlFor="delete-confirm" className="text-sm font-medium">
          Type <span className="font-mono font-bold">DELETE</span> to confirm
        </label>
        <Input
          id="delete-confirm"
          type="text"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="DELETE"
          disabled={isPending}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isPending || confirmation !== "DELETE"}
        >
          {isPending ? "Deleting..." : "Permanently delete"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setShowConfirm(false);
            setConfirmation("");
            setError(null);
          }}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
