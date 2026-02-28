"use client";

import { useTransition } from "react";
import { approveUser, rejectUser } from "@/actions/admin";
import { Button } from "@/components/ui/button";

export function ApproveRejectButtons({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      await approveUser(userId);
    });
  }

  function handleReject() {
    if (!confirm("Reject and delete this user? This cannot be undone.")) return;
    startTransition(async () => {
      await rejectUser(userId);
    });
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={handleApprove} disabled={pending}>
        Approve
      </Button>
      <Button size="sm" variant="destructive" onClick={handleReject} disabled={pending}>
        Reject
      </Button>
    </div>
  );
}
