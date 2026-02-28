"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteCrewMember, restoreCrewMember } from "@/actions/crew";
import { Button } from "@/components/ui/button";

type CrewDetailClientProps = {
  crewId: string;
  action: "delete" | "restore";
  label: string;
};

export function CrewDetailClient({
  crewId,
  action,
  label
}: CrewDetailClientProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (
      action === "delete" &&
      !confirm("Soft delete this crew member? They will be hidden from call sheets.")
    )
      return;
    setPending(true);
    if (action === "delete") {
      await deleteCrewMember(crewId);
      router.push("/talent/crew");
    } else {
      await restoreCrewMember(crewId);
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
