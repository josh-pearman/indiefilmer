import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, getAuthMode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentProjectId, getProjectRole } from "@/lib/project";
import { listTeamMembers } from "@/actions/team";
import {
  listProjectMembers,
  listUsersAvailableToAdd
} from "@/actions/project-members";
import { listPendingInvites } from "@/actions/invites";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMemberForm } from "@/components/settings/add-member-form";
import { TeamMemberList } from "@/components/settings/team-member-list";
import { AddProjectMemberForm } from "@/components/settings/add-project-member-form";
import { ProjectMemberList } from "@/components/settings/project-member-list";
import { InviteForm } from "@/components/settings/invite-form";
import { PendingInvitesList } from "@/components/settings/pending-invites-list";

export default async function PeoplePage() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const projectId = await getCurrentProjectId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { siteRole: true }
  });

  const isSuperadmin = user?.siteRole === "superadmin";
  const projectRole = projectId
    ? await getProjectRole(userId, projectId)
    : null;
  const isProjectAdmin = projectRole === "admin";

  if (!isSuperadmin && !isProjectAdmin) {
    redirect("/settings");
  }

  const authMode = getAuthMode();

  const [teamMembers, projectMembers, availableUsers, pendingInvites] =
    await Promise.all([
      isSuperadmin ? listTeamMembers() : Promise.resolve([]),
      isProjectAdmin ? listProjectMembers() : Promise.resolve([]),
      isProjectAdmin ? listUsersAvailableToAdd() : Promise.resolve([]),
      isProjectAdmin && authMode === "email"
        ? listPendingInvites()
        : Promise.resolve([])
    ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Settings
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuperadmin
            ? "Create users and manage project collaborators."
            : "Add collaborators and manage their access."}
        </p>
      </div>

      {isSuperadmin && authMode === "password" && (
        <Card>
          <CardHeader>
            <CardTitle>Create user</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              New users can sign in with the username and password you set.
            </p>
          </CardHeader>
          <CardContent>
            <AddMemberForm />
          </CardContent>
        </Card>
      )}

      {isProjectAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Add collaborator</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Choose an existing user and assign a role. Collaborators can be
              limited to specific sections.
            </p>
          </CardHeader>
          <CardContent>
            <AddProjectMemberForm availableUsers={availableUsers} />
          </CardContent>
        </Card>
      )}

      {isProjectAdmin && authMode === "email" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Invite by email</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Send an invite link to someone who doesn&apos;t have an account
                yet.
              </p>
            </CardHeader>
            <CardContent>
              <InviteForm />
            </CardContent>
          </Card>

          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending invites</CardTitle>
              </CardHeader>
              <CardContent>
                <PendingInvitesList invites={pendingInvites} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {isProjectAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Project members</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectMemberList members={projectMembers} />
          </CardContent>
        </Card>
      )}

      {isSuperadmin && (
        <Card>
          <CardHeader>
            <CardTitle>All site users</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Every user account on this instance. Only visible to superadmins.
            </p>
          </CardHeader>
          <CardContent>
            <TeamMemberList members={teamMembers} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
