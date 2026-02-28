"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateLocationStatus } from "@/actions/locations";
import { cn } from "@/lib/utils";

const PIPELINE = ["Shortlist", "Contacted", "Visited", "On Hold", "Booked"] as const;
const REJECTED = "Rejected";

type LocationStatusPipelineProps = {
  locationId: string;
  currentStatus: string;
  onStatusChange?: () => void;
};

export function LocationStatusPipeline({
  locationId,
  currentStatus,
  onStatusChange
}: LocationStatusPipelineProps) {
  const [updating, setUpdating] = React.useState(false);
  const router = useRouter();

  async function setStatus(status: string) {
    setUpdating(true);
    await updateLocationStatus(locationId, status);
    onStatusChange?.();
    router.refresh();
    setUpdating(false);
  }

  const isRejected = currentStatus === REJECTED;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {PIPELINE.map((status, i) => (
          <React.Fragment key={status}>
            {i > 0 && (
              <span className="text-muted-foreground px-0.5">→</span>
            )}
            <button
              type="button"
              onClick={() => setStatus(status)}
              disabled={updating}
              className={cn(
                "rounded-md px-2 py-1 text-sm font-medium transition-colors",
                currentStatus === status
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
                updating && "pointer-events-none opacity-70"
              )}
            >
              {status}
            </button>
          </React.Fragment>
        ))}
      </div>
      <div>
        <button
          type="button"
          onClick={() => setStatus(REJECTED)}
          disabled={updating}
          className={cn(
            "rounded-md px-2 py-1 text-sm font-medium transition-colors",
            isRejected
              ? "bg-destructive/20 text-destructive"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            updating && "pointer-events-none opacity-70"
          )}
        >
          Rejected
        </button>
      </div>
    </div>
  );
}
