import { getInviteByToken } from "@/actions/invites";
import { AcceptInviteCard } from "@/components/invite/accept-invite-card";

export default async function InvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="mx-auto w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-card text-center">
          <h1 className="text-xl font-semibold">Invite not found</h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid. It may have been revoked or the URL is incorrect.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <AcceptInviteCard
        token={token}
        email={invite.email}
        role={invite.role}
        projectName={invite.projectName}
        expired={invite.expired}
        accepted={invite.accepted}
      />
    </div>
  );
}
