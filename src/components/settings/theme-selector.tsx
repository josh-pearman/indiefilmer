"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateUserTheme } from "@/actions/settings";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "light", label: "Light", colors: ["#f1f5f9", "#ffffff", "#2563eb"] },
  { id: "dark", label: "Dark", colors: ["#171717", "#1e1e1e", "#60a5fa"] },
  { id: "warm", label: "Warm", colors: ["#ede5d8", "#faf7f2", "#b45309"] }
];

type ThemeSelectorProps = {
  currentTheme: string;
  displayName: string;
};

export function ThemeSelector({ currentTheme, displayName }: ThemeSelectorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  async function selectTheme(themeId: string) {
    if (themeId === currentTheme) return;
    setPending(themeId);
    await updateUserTheme(themeId);
    setPending(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Theme for {displayName}
      </p>
      <div className="flex flex-wrap gap-4">
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => selectTheme(theme.id)}
          disabled={pending !== null}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-opacity",
            currentTheme === theme.id
              ? "border-primary"
              : "border-border hover:border-muted-foreground/50",
            pending && pending !== theme.id && "opacity-50"
          )}
        >
          <div className="flex h-10 w-24 overflow-hidden rounded border border-border">
            <span
              className="block flex-1"
              style={{ backgroundColor: theme.colors[0] }}
            />
            <span
              className="block flex-1"
              style={{ backgroundColor: theme.colors[1] }}
            />
            <span
              className="block w-4"
              style={{ backgroundColor: theme.colors[2] }}
            />
          </div>
          <span className="text-sm font-medium">{theme.label}</span>
          {currentTheme === theme.id && (
            <Check className="h-4 w-4 text-primary" />
          )}
        </button>
      ))}
      </div>
    </div>
  );
}
