"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { SCENE_EXTRACTION_PROMPT } from "@/lib/scene-extraction-prompt";
import { importScenesAndCast } from "@/actions/scenes";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const INSTRUCTIONS = `How to extract scenes, cast, and locations from your script:

1. Copy the prompt below
2. Open Claude (claude.ai) or ChatGPT
3. Upload your screenplay PDF
4. Paste this prompt and send it
5. Copy the JSON output from the LLM
6. Come back here and go to the "Import JSON" tab

This will create location records, cast member records, scene records, and link them all together automatically.`;

type TabId = "prompt" | "import";

type SceneExtractDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SceneExtractDialog({
  open,
  onOpenChange
}: SceneExtractDialogProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("prompt");
  const [jsonInput, setJsonInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [success, setSuccess] = React.useState<{
    locationCount: number;
    castCount: number;
    sceneCount: number;
    skippedCharacterRefs?: number;
    skippedLocationRefs?: number;
  } | null>(null);

  const handleImport = async () => {
    setErrors([]);
    setSuccess(null);
    setPending(true);
    const result = await importScenesAndCast(jsonInput);
    setPending(false);

    if (!result.success && result.errors?.length) {
      setErrors(result.errors);
      return;
    }

    if (result.success) {
      setSuccess({
        locationCount: result.locationCount ?? 0,
        castCount: result.castCount ?? 0,
        sceneCount: result.sceneCount ?? 0,
        skippedCharacterRefs: result.skippedCharacterRefs,
        skippedLocationRefs: result.skippedLocationRefs
      });
      router.refresh();
      setTimeout(() => {
        onOpenChange(false);
        setTab("prompt");
        setJsonInput("");
        setErrors([]);
        setSuccess(null);
      }, 2000);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTab("prompt");
      setJsonInput("");
      setErrors([]);
      setSuccess(null);
    }
    onOpenChange(next);
  };

  // Reset dialog state whenever the dialog is opened
  React.useEffect(() => {
    if (open) {
      setTab("prompt");
      setJsonInput("");
      setErrors([]);
      setSuccess(null);
      setPending(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex flex-col overflow-hidden">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-semibold">Extract from Script</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setTab("prompt")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium",
                tab === "prompt"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Get Prompt
            </button>
            <button
              type="button"
              onClick={() => setTab("import")}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium",
                tab === "import"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              Import JSON
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "prompt" && (
            <div className="space-y-4">
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {INSTRUCTIONS}
              </p>
              <div className="relative">
                <pre className="max-h-[50vh] overflow-auto rounded-md border border-border bg-muted/30 p-4 text-xs">
                  <code>{SCENE_EXTRACTION_PROMPT}</code>
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton
                    text={SCENE_EXTRACTION_PROMPT}
                    label="Copy Prompt"
                    copiedLabel="Copied!"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "import" && (
            <div className="space-y-4">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='Paste the JSON output from the LLM here. It should start with { "locations": [...'
                className="h-64 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                disabled={pending}
              />
              <Button
                type="button"
                onClick={handleImport}
                disabled={pending || !jsonInput.trim()}
              >
                {pending ? "Validating & importing…" : "Validate & Import"}
              </Button>

              {errors.length > 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                  <p className="mb-2 font-medium text-destructive">
                    Validation failed
                  </p>
                  <ul className="max-h-40 list-inside list-disc space-y-1 overflow-y-auto text-sm text-destructive">
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {success && (
                <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm">
                  <p className="font-medium text-green-800">
                    Imported {success.locationCount} locations,{" "}
                    {success.castCount} cast members, and {success.sceneCount}{" "}
                    scenes successfully.
                  </p>
                  {success.skippedCharacterRefs != null &&
                    success.skippedCharacterRefs > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Note: {success.skippedCharacterRefs} character
                        reference(s) in scenes did not match any cast entry and
                        were skipped.
                      </p>
                    )}
                  {success.skippedLocationRefs != null &&
                    success.skippedLocationRefs > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Note: {success.skippedLocationRefs} location
                        reference(s) in scenes did not match any location entry
                        and were skipped.
                      </p>
                    )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
