"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, RotateCcw } from "lucide-react";
import {
  setCurrentScriptVersion,
  deleteScriptVersion,
  restoreScriptVersion
} from "@/actions/script-versions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { ScriptVersionEditForm } from "./script-version-edit-form";
import { cn } from "@/lib/utils";

type ScriptVersion = {
  id: string;
  versionName: string;
  filePath: string;
  fileName: string | null;
  pageCount: number | null;
  notes: string | null;
  isCurrent: boolean;
  isDeleted: boolean;
  createdAt: Date;
};

type ScriptVersionCardProps = {
  version: ScriptVersion;
};

const NOTES_PREVIEW_LENGTH = 60;

export function ScriptVersionCard({ version }: ScriptVersionCardProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [settingCurrent, setSettingCurrent] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [restoring, setRestoring] = React.useState(false);

  const downloadUrl = `/api/scripts/${encodeURIComponent(version.filePath)}`;
  const notesPreview =
    version.notes?.slice(0, NOTES_PREVIEW_LENGTH).trim() ?? "";
  const notesTruncated =
    version.notes != null && version.notes.length > NOTES_PREVIEW_LENGTH;

  async function handleSetCurrent() {
    setSettingCurrent(true);
    await setCurrentScriptVersion(version.id);
    setSettingCurrent(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this script version? You can restore it later."))
      return;
    setDeleting(true);
    await deleteScriptVersion(version.id);
    setDeleting(false);
    router.refresh();
  }

  async function handleRestore() {
    setRestoring(true);
    await restoreScriptVersion(version.id);
    setRestoring(false);
    router.refresh();
  }

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm",
          version.isDeleted && "opacity-70"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-semibold",
                version.isDeleted && "line-through text-muted-foreground"
              )}
            >
              {version.versionName}
            </span>
            {version.isCurrent && (
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs font-medium text-primary">
                Current
              </span>
            )}
            {version.isDeleted && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                Deleted
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0 text-xs text-muted-foreground">
            <span>
              {new Date(version.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
              })}
            </span>
            {version.pageCount != null && (
              <span>{version.pageCount} pages</span>
            )}
            {notesPreview && (
              <span className="truncate" title={version.notes ?? undefined}>
                {notesPreview}
                {notesTruncated ? "…" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!version.isDeleted && (
            <>
              <Button asChild size="sm" variant="ghost" className="h-8">
                <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" aria-hidden />
                </a>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setEditOpen(true)}
              >
                Edit
              </Button>
              {!version.isCurrent && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={handleSetCurrent}
                  disabled={settingCurrent}
                >
                  {settingCurrent ? "Setting…" : "Set as Current"}
                </Button>
              )}
              {!version.isCurrent && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  aria-label={`Delete ${version.versionName}`}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {deleting ? "Deleting…" : "Delete"}
                </Button>
              )}
            </>
          )}
          {version.isDeleted && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleRestore}
              disabled={restoring}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {restoring ? "Restoring…" : "Restore"}
            </Button>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Edit script version</h2>
              <ScriptVersionEditForm
              version={version}
              onSuccess={() => {
                setEditOpen(false);
                router.refresh();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
