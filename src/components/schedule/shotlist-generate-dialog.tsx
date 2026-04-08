"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { SHOTLIST_PROFILES, type ShotlistProfile } from "@/lib/shotlist-profiles";
import { buildShotlistPrompt, type ShotlistSceneContext } from "@/lib/shotlist-prompt";
import { importShots, clearShotsForShootDay } from "@/actions/scenes";
import { cn } from "@/lib/utils";

type TabId = "prompt" | "import";

type ShotlistGenerateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shootDayId: string;
  shootDayLabel: string;
  scenes: ShotlistSceneContext[];
  /** Maps scene numbers to scene IDs for the import action */
  sceneNumberToId: Record<string, string>;
  hasExistingShots: boolean;
};

const INSTRUCTIONS = `How to generate a shot list with your own AI:

1. Pick a shooting profile below
2. Copy the generated prompt
3. Open Claude (claude.ai) or ChatGPT
4. Paste the prompt and send it
5. Copy the JSON output from the AI
6. Come back here and go to the "Import JSON" tab

The AI will generate shots for every scene scheduled on this day, tailored to your chosen shooting profile.`;

export function ShotlistGenerateDialog({
  open,
  onOpenChange,
  shootDayId,
  shootDayLabel,
  scenes,
  sceneNumberToId,
  hasExistingShots
}: ShotlistGenerateDialogProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabId>("prompt");
  const [profileId, setProfileId] = React.useState<string>("standard");
  const [jsonInput, setJsonInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [success, setSuccess] = React.useState<{
    shotCount: number;
    sceneCount: number;
    skippedSceneRefs?: number;
  } | null>(null);

  const selectedProfile = SHOTLIST_PROFILES.find((p) => p.id === profileId) ?? SHOTLIST_PROFILES[0];

  const generatedPrompt = React.useMemo(
    () => buildShotlistPrompt(scenes, selectedProfile, shootDayLabel),
    [scenes, selectedProfile, shootDayLabel]
  );

  const handleImport = async () => {
    setErrors([]);
    setSuccess(null);
    setPending(true);

    // If there are existing shots, clear them first
    if (hasExistingShots) {
      const clearResult = await clearShotsForShootDay(shootDayId);
      if (clearResult.error) {
        setErrors([clearResult.error]);
        setPending(false);
        return;
      }
    }

    const result = await importShots(jsonInput, sceneNumberToId);
    setPending(false);

    if (!result.success && result.errors?.length) {
      setErrors(result.errors);
      return;
    }

    if (result.success) {
      setSuccess({
        shotCount: result.shotCount ?? 0,
        sceneCount: result.sceneCount ?? 0,
        skippedSceneRefs: result.skippedSceneRefs
      });
      router.refresh();
      setTimeout(() => {
        onOpenChange(false);
        resetState();
      }, 2000);
    }
  };

  const resetState = () => {
    setTab("prompt");
    setJsonInput("");
    setErrors([]);
    setSuccess(null);
    setPending(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  React.useEffect(() => {
    if (open) resetState();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-semibold">Generate Shot List</h2>
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

              {/* Profile picker */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Shooting Profile</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SHOTLIST_PROFILES.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setProfileId(profile.id)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        profileId === profile.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                      )}
                    >
                      <span className="font-medium">{profile.name}</span>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {profile.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scene summary */}
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium">
                  {scenes.length} scene{scenes.length !== 1 ? "s" : ""} on this day
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {scenes.map((s) => (
                    <li key={s.sceneNumber}>
                      Scene {s.sceneNumber}
                      {s.title ? ` — ${s.title}` : ""}
                      {s.intExt ? ` (${s.intExt}` : ""}
                      {s.dayNight ? ` ${s.dayNight})` : s.intExt ? ")" : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Generated prompt */}
              <div className="relative">
                <pre className="max-h-[40vh] overflow-auto rounded-md border border-border bg-muted/30 p-4 text-xs">
                  <code>{generatedPrompt}</code>
                </pre>
                <div className="absolute right-2 top-2">
                  <CopyButton
                    text={generatedPrompt}
                    label="Copy Prompt"
                    copiedLabel="Copied!"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === "import" && (
            <div className="space-y-4">
              {hasExistingShots && (
                <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium text-amber-800">
                    Existing shots will be replaced
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    The scenes on this day already have shots. Importing will
                    remove the existing shots and replace them with the new ones.
                  </p>
                </div>
              )}

              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='Paste the JSON output from the AI here. It should start with { "shots": [...'
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
                    Imported {success.shotCount} shots across{" "}
                    {success.sceneCount} scene{success.sceneCount !== 1 ? "s" : ""}.
                  </p>
                  {success.skippedSceneRefs != null &&
                    success.skippedSceneRefs > 0 && (
                      <p className="mt-1 text-muted-foreground">
                        Note: {success.skippedSceneRefs} shot(s) referenced
                        scene numbers not assigned to this day and were skipped.
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
