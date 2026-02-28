"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskQuickAddProps = {
  status: string;
  onAdd: (title: string, status: string) => void;
  className?: string;
};

export function TaskQuickAdd({ status, onAdd, className }: TaskQuickAddProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  function handleSubmit() {
    const trimmed = title.trim();
    if (trimmed) {
      onAdd(trimmed, status);
      setTitle("");
    }
    // keep input open for rapid entry
  }

  const submittedRef = React.useRef(false);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submittedRef.current = true;
      handleSubmit();
    } else if (e.key === "Escape") {
      submittedRef.current = true;
      setTitle("");
      setIsOpen(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
          className
        )}
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div className={cn("px-1", className)}>
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (!submittedRef.current) handleSubmit();
          submittedRef.current = false;
          setIsOpen(false);
        }}
        placeholder="Task title..."
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
