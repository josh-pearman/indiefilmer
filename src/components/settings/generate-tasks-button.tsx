"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  scanForTaskCandidates,
  createTaskFromCandidate,
  finishTaskGeneration,
  type TaskCandidate,
} from "@/actions/generate-tasks";

type Phase = "idle" | "scanning" | "creating" | "done";

export function GenerateTasksButton() {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [total, setTotal] = React.useState(0);
  const [completed, setCompleted] = React.useState(0);
  const [currentTitle, setCurrentTitle] = React.useState("");
  const [skipped, setSkipped] = React.useState(0);
  const [created, setCreated] = React.useState(0);

  async function handleClick() {
    setPhase("scanning");
    setCompleted(0);
    setTotal(0);
    setCreated(0);
    setSkipped(0);
    setCurrentTitle("");

    const { candidates, skipped: skippedCount } = await scanForTaskCandidates();
    setSkipped(skippedCount);

    if (candidates.length === 0) {
      setPhase("done");
      return;
    }

    setPhase("creating");
    setTotal(candidates.length);

    for (let i = 0; i < candidates.length; i++) {
      setCurrentTitle(candidates[i].title);
      await createTaskFromCandidate(candidates[i]);
      setCompleted(i + 1);
    }

    setCreated(candidates.length);
    await finishTaskGeneration();
    setPhase("done");
  }

  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <Button
        size="sm"
        onClick={handleClick}
        disabled={phase === "scanning" || phase === "creating"}
      >
        {phase === "scanning"
          ? "Scanning…"
          : phase === "creating"
            ? "Creating…"
            : "Generate Major Tasks"}
      </Button>

      {(phase === "scanning" || phase === "creating") && (
        <div className="space-y-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{
                width: phase === "scanning" ? "100%" : `${pct}%`,
                animation:
                  phase === "scanning"
                    ? "pulse 1.5s ease-in-out infinite"
                    : undefined,
                opacity: phase === "scanning" ? 0.5 : 1,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {phase === "scanning"
              ? "Scanning project for gaps…"
              : `${completed} / ${total} — ${currentTitle}`}
          </p>
        </div>
      )}

      {phase === "done" && (
        <p className="text-sm text-muted-foreground">
          {created > 0
            ? `Created ${created} task${created === 1 ? "" : "s"}.`
            : "No new tasks to create."}{" "}
          {skipped > 0 && `${skipped} already existed.`}
        </p>
      )}
    </div>
  );
}
