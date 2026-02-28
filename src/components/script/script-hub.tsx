"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ScriptCurrentHero } from "./script-current-hero";
import { ScriptUploadForm, defaultScriptUploadFormValues } from "./script-upload-form";
import { ScriptVersionCard } from "./script-version-card";
import { ColorCodedScriptButton } from "./color-coded-script-button";

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

type ScriptHubProps = {
  currentVersion: ScriptVersion | null;
  allVersions: ScriptVersion[];
};

export function ScriptHub({ currentVersion, allVersions }: ScriptHubProps) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [showDeleted, setShowDeleted] = React.useState(false);

  const visibleVersions = React.useMemo(() => {
    const list = showDeleted
      ? allVersions
      : allVersions.filter((v) => !v.isDeleted);
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allVersions, showDeleted]);

  return (
    <div className="space-y-6">
      {/* Hero: current draft or empty state */}
      <section>
        {currentVersion ? (
          <ScriptCurrentHero
            version={{
              id: currentVersion.id,
              versionName: currentVersion.versionName,
              filePath: currentVersion.filePath,
              fileName: currentVersion.fileName,
              pageCount: currentVersion.pageCount,
              notes: currentVersion.notes,
              createdAt: currentVersion.createdAt
            }}
          />
        ) : (
          <Card className="border-dashed border-2 border-muted-foreground/25">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                No script uploaded yet. Upload your first draft to get started.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload script
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="">
                    <div className="space-y-4">
                      <h2 className="text-lg font-semibold">Upload New Draft</h2>
                      <ScriptUploadForm
                        defaultValues={defaultScriptUploadFormValues}
                        onSuccess={() => setUploadOpen(false)}
                        onCancel={() => setUploadOpen(false)}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                <ColorCodedScriptButton />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Or generate a color-coded scene breakdown from your existing scenes and locations.
              </p>
            </CardContent>
          </Card>
        )}

        {currentVersion && (
          <div className="mt-4">
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload New Draft
                </Button>
              </DialogTrigger>
              <DialogContent className="">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold">Upload New Draft</h2>
                  <ScriptUploadForm
                    defaultValues={defaultScriptUploadFormValues}
                    onSuccess={() => setUploadOpen(false)}
                    onCancel={() => setUploadOpen(false)}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </section>

      {/* Revision history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>Revision history</CardTitle>
          <label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              className="rounded border-border"
            />
            Show deleted
          </label>
        </CardHeader>
        <CardContent>
          {visibleVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {showDeleted
                ? "No script versions (including deleted)."
                : "No script versions yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleVersions.map((v) => (
                <li key={v.id}>
                  <ScriptVersionCard version={v} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
