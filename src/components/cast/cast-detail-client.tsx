"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteCastMember, restoreCastMember } from "@/actions/cast";
import { Button } from "@/components/ui/button";

type CastDetailClientProps = {
  castId: string;
  action: "delete" | "restore";
  label: string;
};

export function CastDetailClient({
  castId,
  action,
  label
}: CastDetailClientProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (
      action === "delete" &&
      !confirm("Soft delete this cast member? They will be hidden from lists and the Scenes Add Cast dropdown.")
    )
      return;
    setPending(true);
    if (action === "delete") {
      await deleteCastMember(castId);
      router.push("/talent/cast");
    } else {
      await restoreCastMember(castId);
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
