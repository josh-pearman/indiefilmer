"use client";

import * as React from "react";
import { resetMemberPassword, removeMember, type TeamState } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Member = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  approved: boolean;
  siteRole: string;
  createdAt: Date;
};

export function TeamMemberList({ members }: { members: Member[] }) {
  const [resettingId, setResettingId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<TeamState>({});
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  async function handleResetPassword(userId: string, formData: FormData) {
    setMessage({});
    const result = await resetMemberPassword({}, formData);
    setMessage(result);
    if (result.success) setResettingId(null);
  }

  async function handleRemove(userId: string) {
    if (!confirm("Remove this member? They will no longer be able to log in.")) return;
    setRemovingId(userId);
    const result = await removeMember(userId);
    setMessage(result);
    setRemovingId(null);
  }

  return (
    <div className="space-y-4">
      {message.error && (
        <p className="text-sm text-destructive">{message.error}</p>
      )}
      {message.success && (
        <p className="text-sm text-green-600 dark:text-green-400">{message.success}</p>
      )}
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0">
            <div>
              <span className="font-medium">{m.name ?? m.username ?? m.email ?? m.id}</span>
              {m.username && (
                <span className="ml-2 text-sm text-muted-foreground">@{m.username}</span>
              )}
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{m.siteRole}</span>
              {!m.approved && (
                <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(not approved)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {resettingId === m.id ? (
                <ResetPasswordForm
                  userId={m.id}
                  onCancel={() => setResettingId(null)}
                  onSubmit={(fd) => handleResetPassword(m.id, fd)}
                />
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResettingId(m.id)}
                  >
                    Reset password
                  </Button>
                  {m.siteRole !== "superadmin" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemove(m.id)}
                      disabled={removingId === m.id}
                    >
                      Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ResetPasswordForm({
  userId,
  onCancel,
  onSubmit
}: {
  userId: string;
  onCancel: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("userId", userId);
    await onSubmit(fd);
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Label htmlFor={`pw-${userId}`} className="sr-only">New password</Label>
      <Input
        id={`pw-${userId}`}
        name="newPassword"
        type="password"
        placeholder="New password"
        minLength={12}
        required
        className="h-8 w-40"
      />
      <Button size="sm" type="submit">Save</Button>
      <Button size="sm" type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
    </form>
  );
}
