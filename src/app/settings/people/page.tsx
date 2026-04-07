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

  const [teamMembers, allProjectMembers, availableUsers, pendingInvites] =
    await Promise.all([
      isSuperadmin ? listTeamMembers() : Promise.resolve([]),
      isProjectAdmin ? listProjectMembers() : Promise.resolve([]),
      isProjectAdmin && isSuperadmin ? listUsersAvailableToAdd() : Promise.resolve([]),
      isProjectAdmin && authMode === "email"
        ? listPendingInvites()
        : Promise.resolve([])
    ]);

  // Exclude the current user from the collaborator panels
  const projectMembers = allProjectMembers.filter((m) => m.userId !== userId);

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

      {isProjectAdmin && authMode === "email" && (
        <Card>
          <CardHeader>
            <CardTitle>Invite by email</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm />
          </CardContent>
        </Card>
      )}

      {isProjectAdmin && authMode === "email" && pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent>
            <PendingInvitesList invites={pendingInvites} />
          </CardContent>
        </Card>
      )}

      {isProjectAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Manage collaborators</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Edit roles and section access for your collaborators.
            </p>
          </CardHeader>
          <CardContent>
            <ProjectMemberList members={projectMembers} mode="edit" />
          </CardContent>
        </Card>
      )}

      {isProjectAdmin && projectMembers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Remove access</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Remove a collaborator from this project.
            </p>
          </CardHeader>
          <CardContent>
            <ProjectMemberList members={projectMembers} mode="remove" />
          </CardContent>
        </Card>
      )}

      {isProjectAdmin && isSuperadmin && availableUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add existing user</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Add a site user directly to this project.
            </p>
          </CardHeader>
          <CardContent>
            <AddProjectMemberForm availableUsers={availableUsers} />
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
