"use client";

import * as React from "react";
import Link from "next/link";
import { createBackupAction } from "@/actions/backup";
import { Button } from "@/components/ui/button";
import { createLogger } from "@/lib/logger";

const logger = createLogger("backup-manager");

type BackupManagerProps = {
  backups: Array<{ filename: string; date: string; size: string }>;
};

export function BackupManager({ backups: initialBackups }: BackupManagerProps) {
  const [backups, setBackups] = React.useState(initialBackups);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function handleCreate() {
    setMessage(null);
    setPending(true);
    try {
      const result = await createBackupAction();
      if (result.error) {
        logger.error("Failed to create backup", {
          action: "handleCreate",
          error: result.error,
        });
        setMessage(result.error);
      } else {
        setMessage("Backup created.");
        setBackups((prev) => {
          const name = result.path!.split(/[/\\]/).pop() ?? "backup.zip";
          const match = name.match(/backup-(\d{4}-\d{2}-\d{2}-\d{6})\.zip$/);
          const date = match
            ? `${match[1].slice(0, 10)} ${match[1].slice(11, 13)}:${match[1].slice(13, 15)}:${match[1].slice(15, 17)}`
            : "Just now";
          return [{ filename: name, date, size: "—" }, ...prev.slice(0, 9)];
        });
      }
    } catch (err) {
      logger.error("Failed to create backup", {
        action: "handleCreate",
        error: err instanceof Error ? err.message : String(err),
      });
      setMessage("Failed to create backup.");
    }
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCreate}
          disabled={pending}
        >
          {pending ? "Creating Backup…" : "Create Backup"}
        </Button>
        {message && (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
      {backups.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {backups.map((b) => (
            <li
              key={b.filename}
              className="flex items-center justify-between gap-4 rounded border border-border px-3 py-2"
            >
              <span className="truncate font-mono text-muted-foreground">
                {b.filename}
              </span>
              <span className="text-muted-foreground">{b.date}</span>
              <span className="text-muted-foreground">{b.size}</span>
              <Link
                href={`/api/backups/${encodeURIComponent(b.filename)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Download
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No backups yet.</p>
      )}
      <div className="rounded border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">About backups</p>
        <p className="mt-1">
          Each backup contains this project&apos;s data and uploaded files as a zip.
          Other projects are not affected. To restore, use the project&apos;s restore
          feature or contact your admin.
        </p>
      </div>
    </div>
  );
}
