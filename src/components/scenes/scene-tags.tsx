"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toggleSceneTag } from "@/actions/scenes";
import { runAction } from "@/hooks/use-action-feedback";
import { cn } from "@/lib/utils";

const TAGS: Array<{ tag: string; label: string; emoji: string }> = [
  { tag: "sound_risk", label: "Sound risk", emoji: "🔊" },
  { tag: "permit_risk", label: "Permit risk", emoji: "📋" },
  { tag: "stunts", label: "Stunts", emoji: "🤸" },
  { tag: "intimacy", label: "Intimacy", emoji: "❗" },
  { tag: "vfx", label: "VFX", emoji: "✨" },
  { tag: "special_props", label: "Special props", emoji: "🎭" },
  { tag: "crowd", label: "Crowd", emoji: "👥" },
  { tag: "night_ext", label: "Night exterior", emoji: "🌙" }
];

type SceneTagsProps = {
  sceneId: string;
  activeTags: string[];
};

export function SceneTags({ sceneId, activeTags }: SceneTagsProps) {
  const [pending, setPending] = React.useState<string | null>(null);
  const router = useRouter();

  async function handleToggle(tag: string) {
    setPending(tag);
    await runAction(() => toggleSceneTag(sceneId, tag), "Toggle tag failed");
    setPending(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {TAGS.map(({ tag, label, emoji }) => {
        const isActive = activeTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => handleToggle(tag)}
            disabled={pending !== null}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
              pending !== null && "pointer-events-none opacity-70"
            )}
          >
            {emoji} {label}
          </button>
        );
      })}
    </div>
  );
}
