"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { uploadShotlist, removeShotlist } from "@/actions/scenes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paperclip, FileImage, Trash2, Upload } from "lucide-react";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

type SceneShotlistProps = {
  sceneId: string;
  shotlistPath: string | null;
};

function isImageFilename(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  return IMAGE_EXTS.includes(ext);
}

export function SceneShotlist({ sceneId, shotlistPath }: SceneShotlistProps) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filename = shotlistPath ? shotlistPath.replace(/^[^-]+-/, "") : null;
  const isImage = shotlistPath ? isImageFilename(shotlistPath) : false;
  const downloadUrl = shotlistPath
    ? `/api/shotlists/${encodeURIComponent(shotlistPath)}`
    : null;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadShotlist(sceneId, formData);
    setUploading(false);
    e.target.value = "";
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleRemove() {
    if (!confirm("Remove this shotlist? You can upload a new one later.")) return;
    setError(null);
    setRemoving(true);
    const result = await removeShotlist(sceneId);
    setRemoving(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shotlist</CardTitle>
        <p className="text-sm text-muted-foreground">
          Attach a shotlist document (PDF, image) for this scene.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!shotlistPath ? (
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading…" : "Upload Shotlist"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {isImage && (
              <div className="rounded-md border border-border overflow-hidden max-w-xs bg-muted">
                <img
                  src={downloadUrl!}
                  alt="Shotlist preview"
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={downloadUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                {isImage ? (
                  <FileImage className="h-4 w-4" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
                {filename ?? shotlistPath}
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <a href={downloadUrl!} target="_blank" rel="noopener noreferrer">
                  View
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mr-1 h-3.5 w-3.5" />
                Replace
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removing}
                onClick={handleRemove}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
