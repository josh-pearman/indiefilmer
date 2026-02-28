'use client';

import * as React from "react";
import { createBackupAction } from "@/actions/backup";
import { Button } from "@/components/ui/button";
import { createLogger } from "@/lib/logger";

const logger = createLogger("create-backup-button");

export function CreateBackupButton() {
  const [isPending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  const onClick = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        await createBackupAction();
        setMessage("Backup created.");
      } catch (err) {
        logger.error("Failed to create backup", {
          action: "onClick",
          error: err instanceof Error ? err.message : String(err),
        });
        setMessage("Failed to create backup.");
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-center"
        onClick={onClick}
        disabled={isPending}
      >
        {isPending ? "Creating Backup…" : "Create Backup"}
      </Button>
      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
}

