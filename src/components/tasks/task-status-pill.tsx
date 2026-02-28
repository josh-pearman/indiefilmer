"use client";

import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Todo: { label: "To Do", bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-500 dark:text-zinc-400" },
  Doing: { label: "Doing", bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300" },
  Done: { label: "Done", bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-700 dark:text-emerald-300" }
};

type TaskStatusPillProps = {
  status: string;
  size?: "sm" | "md";
  className?: string;
};

export function TaskStatusPill({ status, size = "sm", className }: TaskStatusPillProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.Doing;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        config.bg,
        config.text,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
