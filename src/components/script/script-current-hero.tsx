"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ColorCodedScriptButton } from "./color-coded-script-button";

type ScriptVersion = {
  id: string;
  versionName: string;
  filePath: string;
  fileName: string | null;
  pageCount: number | null;
  notes: string | null;
  createdAt: Date;
};

type ScriptCurrentHeroProps = {
  version: ScriptVersion | null;
};

export function ScriptCurrentHero({ version }: ScriptCurrentHeroProps) {
  if (!version) return null;

  const isPdf =
    version.fileName?.toLowerCase().endsWith(".pdf") ??
    version.filePath.toLowerCase().endsWith(".pdf");
  const downloadUrl = `/api/scripts/${encodeURIComponent(version.filePath)}`;
  const viewUrl = isPdf
    ? `/api/scripts/${encodeURIComponent(version.filePath)}?inline=1`
    : null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
            Current Draft
          </span>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          {version.versionName}
        </h2>
        {version.fileName && (
          <p className="text-sm text-muted-foreground">{version.fileName}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Uploaded:</dt>
            <dd>
              {new Date(version.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
              })}
            </dd>
          </div>
          {version.pageCount != null && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Pages:</dt>
              <dd>{version.pageCount}</dd>
            </div>
          )}
          {version.notes && (
            <div>
              <dt className="text-muted-foreground mb-0.5">Notes:</dt>
              <dd className="text-muted-foreground">{version.notes}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm" variant="default">
            <a href={downloadUrl} download target="_blank" rel="noopener noreferrer">
              Download
            </a>
          </Button>
          {viewUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                View
              </a>
            </Button>
          )}
          <ColorCodedScriptButton />
          <Button
            size="sm"
            variant="outline"
            className="text-muted-foreground"
            disabled
            title="Set another version as current in the revision history below, then you can delete this one."
          >
            Delete (set another as current first)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
