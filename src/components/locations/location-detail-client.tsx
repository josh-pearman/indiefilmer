"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteLocation, restoreLocation } from "@/actions/locations";
import { Button } from "@/components/ui/button";

type LocationDetailClientProps = {
  locationId: string;
  action: "delete" | "restore";
  label: string;
};

export function LocationDetailClient({
  locationId,
  action,
  label
}: LocationDetailClientProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (action === "delete" && !confirm("Soft delete this location? It will be hidden from the list.")) return;
    setPending(true);
    if (action === "delete") {
      await deleteLocation(locationId);
      router.push("/production/locations");
    } else {
      await restoreLocation(locationId);
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
