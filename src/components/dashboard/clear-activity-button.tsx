"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { clearActivity } from "@/actions/settings";
import { Button } from "@/components/ui/button";

export function ClearActivityButton() {
  const router = useRouter();
  const [clearing, setClearing] = React.useState(false);

  const handleClear = async () => {
    if (!confirm("Clear all activity history?")) return;
    setClearing(true);
    await clearActivity();
    setClearing(false);
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClear}
      disabled={clearing}
    >
      {clearing ? "Clearing…" : "Clear activity"}
    </Button>
  );
}
