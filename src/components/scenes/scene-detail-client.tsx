"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteScene, restoreScene } from "@/actions/scenes";
import { runAction } from "@/hooks/use-action-feedback";
import { Button } from "@/components/ui/button";

type SceneDetailClientProps = {
  sceneId: string;
  action: "delete" | "restore";
  label: string;
};

export function SceneDetailClient({
  sceneId,
  action,
  label
}: SceneDetailClientProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (
      action === "delete" &&
      !confirm("Soft delete this scene? It will be hidden from lists.")
    )
      return;
    setPending(true);
    if (action === "delete") {
      const result = await runAction(() => deleteScene(sceneId), "Delete scene failed");
      if (!result.error) router.push("/script/scenes");
    } else {
      await runAction(() => restoreScene(sceneId), "Restore scene failed");
      router.refresh();
    }
    setPending(false);
  }

  return (
    <Button
      type="button"
      variant={action === "delete" ? "destructive" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "…" : label}
    </Button>
  );
}
