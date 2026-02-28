"use client";

import { cn } from "@/lib/utils";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  urgent: { label: "Urgent", color: "bg-red-500", border: "border-l-red-500" },
  high: { label: "High", color: "bg-orange-500", border: "border-l-orange-500" },
  medium: { label: "Medium", color: "bg-yellow-500", border: "border-l-yellow-500" },
  low: { label: "Low", color: "bg-blue-400", border: "border-l-blue-400" },
  none: { label: "None", color: "bg-zinc-300 dark:bg-zinc-600", border: "border-l-transparent" }
};

type TaskPriorityIconProps = {
  priority: string;
  showLabel?: boolean;
  className?: string;
};

export function TaskPriorityIcon({ priority, showLabel = false, className }: TaskPriorityIconProps) {
  const config = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.none;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("h-2 w-2 rounded-full shrink-0", config.color)} />
      {showLabel && <span className="text-xs text-muted-foreground">{config.label}</span>}
    </span>
  );
}

export function getPriorityBorderClass(priority: string): string {
  return PRIORITY_CONFIG[priority]?.border ?? PRIORITY_CONFIG.none.border;
}

export { PRIORITY_CONFIG };
