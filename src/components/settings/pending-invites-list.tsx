"use client";

import * as React from "react";
import { revokeInvite } from "@/actions/invites";
import { Button } from "@/components/ui/button";

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
};

export function PendingInvitesList({ invites }: { invites: PendingInvite[] }) {
  const [list, setList] = React.useState(invites);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No pending invites.</p>
    );
  }

  async function handleRevoke(inviteId: string) {
    setFeedback(null);
    const result = await revokeInvite(inviteId);
    if (result.error) {
      setFeedback(result.error);
    } else {
      setList((prev) => prev.filter((i) => i.id !== inviteId));
      setFeedback(result.success ?? "Invite revoked.");
    }
  }

  return (
    <div className="space-y-3">
      {feedback && (
        <p className="text-sm text-muted-foreground">{feedback}</p>
      )}
      {list.map((invite) => (
        <div
          key={invite.id}
          className="flex items-center justify-between rounded-md border border-border px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium">{invite.email}</p>
            <p className="text-xs text-muted-foreground">
              {invite.role} &middot; expires{" "}
              {new Date(invite.expiresAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRevoke(invite.id)}
          >
            Revoke
          </Button>
        </div>
      ))}
    </div>
  );
}
