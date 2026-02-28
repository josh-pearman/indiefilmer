import { prisma } from "@/lib/db";
import { getSessionUser, getAuthMode } from "@/lib/auth";
import { getCurrentProjectId, getProjectRole } from "@/lib/project";
import {
  getDeletedCounts,
  listBackups,
  getStorageUsage
} from "@/actions/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectInfoForm } from "@/components/settings/project-info-form";
import { ThemeSelector } from "@/components/settings/theme-selector";
import { CraftServicesDefaultsForm } from "@/components/settings/craft-services-defaults-form";
import { PurgeDeletedButton } from "@/components/settings/purge-deleted-button";
import { ResetProjectButton } from "@/components/settings/reset-project-button";
import { GenerateTasksButton } from "@/components/settings/generate-tasks-button";
import { DeleteUnassignedButton } from "@/components/settings/delete-unassigned-button";
import { BackupManager } from "@/components/settings/backup-manager";
import { DeleteAccountButton } from "@/components/settings/delete-account-button";
import { DeleteProjectButton } from "@/components/settings/delete-project-button";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import Link from "next/link";

export default async function SettingsPage() {
  const projectId = await getCurrentProjectId();
  if (!projectId) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">No project selected. Select or create a project first.</p>
      </div>
    );
  }
  const userId = await getSessionUser();
  const [settings, deletedCounts, backups, storageUsage, projectRole] = await Promise.all([
    prisma.projectSettings.findUnique({ where: { projectId } }),
    getDeletedCounts(),
    listBackups(),
    getStorageUsage(),
    userId ? getProjectRole(userId, projectId) : Promise.resolve(null)
  ]);

  const projectName = settings?.projectName ?? "Untitled Project";
  const totalBudget = settings?.totalBudget ?? 10000;
  const currencySymbol = settings?.currencySymbol ?? "$";
  const craftyPerPerson = settings?.craftyPerPerson ?? 5;
  const lunchPerPerson = settings?.lunchPerPerson ?? 12;
  const dinnerPerPerson = settings?.dinnerPerPerson ?? 12;
  const craftyEnabledByDefault = settings?.craftyEnabledByDefault ?? true;
  const lunchEnabledByDefault = settings?.lunchEnabledByDefault ?? true;
  const dinnerEnabledByDefault = settings?.dinnerEnabledByDefault ?? false;

  const authMode = getAuthMode();
  let displayName = "You";
  let colorTheme = "light";
  let siteRole: string | null = null;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, colorTheme: true, siteRole: true }
    });
    displayName = user?.name ?? user?.username ?? "You";
    colorTheme = user?.colorTheme ?? "light";
    siteRole = user?.siteRole ?? null;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Project info, appearance, data management, and backups.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Switch Project</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Switch to a different project or create a new one.
          </p>
        </CardHeader>
        <CardContent>
          <Link href="/projects">
            <span className="text-primary underline hover:no-underline">Switch project →</span>
          </Link>
        </CardContent>
      </Card>

      {(projectRole === "admin" || siteRole === "superadmin") && (
        <Card>
          <CardHeader>
            <CardTitle>People</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {siteRole === "superadmin"
                ? "Create users and manage project collaborators."
                : "Add collaborators and manage their access."}
            </p>
          </CardHeader>
          <CardContent>
            <Link href="/settings/people">
              <span className="text-primary underline hover:no-underline">Manage people →</span>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Project Info</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectInfoForm
            projectName={projectName}
            totalBudget={totalBudget}
            currencySymbol={currencySymbol}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Choose a color theme. This setting is per-user.
          </p>
        </CardHeader>
        <CardContent>
          <ThemeSelector currentTheme={colorTheme} displayName={displayName} />
        </CardContent>
      </Card>

      {authMode === "password" && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Update your account password.
            </p>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Craft Services</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Default per-person costs and which meal types are enabled when creating new shoot days.
          </p>
        </CardHeader>
        <CardContent>
          <CraftServicesDefaultsForm
            currencySymbol={currencySymbol}
            craftyPerPerson={craftyPerPerson}
            lunchPerPerson={lunchPerPerson}
            dinnerPerPerson={dinnerPerPerson}
            craftyEnabledByDefault={craftyEnabledByDefault}
            lunchEnabledByDefault={lunchEnabledByDefault}
            dinnerEnabledByDefault={dinnerEnabledByDefault}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Generation</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Scan your project for uncasted roles, unfilled crew positions,
            scenes without locations, and locations without addresses, then
            create to-do items for each.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <GenerateTasksButton />
          <DeleteUnassignedButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Purge soft-deleted records or reset the entire project.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="mb-2 text-sm font-medium">Purge deleted records</h4>
            <PurgeDeletedButton counts={deletedCounts} />
          </div>
          <div className="border-t border-border pt-6">
            <h4 className="mb-2 text-sm font-medium">Reset project</h4>
            <p className="mb-3 text-sm text-muted-foreground">
              Remove all data and return to a blank state. You must type the
              project name to confirm.
            </p>
            <ResetProjectButton projectName={projectName} />
          </div>
          {projectRole === "admin" && (
            <div className="border-t border-red-200 dark:border-red-900 pt-6">
              <h4 className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">Delete project</h4>
              <p className="mb-3 text-sm text-muted-foreground">
                Permanently delete this project, all its data, uploaded files, and backups.
                All collaborators will lose access.
              </p>
              <DeleteProjectButton projectName={projectName} />
            </div>
          )}
        </CardContent>
      </Card>

      {siteRole === "superadmin" && authMode === "email" && (
        <Card>
          <CardHeader>
            <CardTitle>Pending approvals</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Approve or reject users who signed up via email.
            </p>
          </CardHeader>
          <CardContent>
            <Link href="/admin">
              <span className="text-primary underline hover:no-underline">Review pending →</span>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            File uploads for this project (scripts, receipts, shotlists, attachments).
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span>{storageUsage.usedFormatted} used</span>
              <span className="text-muted-foreground">{storageUsage.quotaFormatted} limit</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className={`h-2 rounded-full transition-all ${
                  storageUsage.percentUsed > 90
                    ? "bg-red-500"
                    : storageUsage.percentUsed > 70
                      ? "bg-yellow-500"
                      : "bg-primary"
                }`}
                style={{ width: `${Math.min(storageUsage.percentUsed, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{storageUsage.percentUsed}% used</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup &amp; Restore</CardTitle>
        </CardHeader>
        <CardContent>
          <BackupManager backups={backups} />
        </CardContent>
      </Card>

      {siteRole !== "superadmin" && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Permanently delete your account and leave all projects.
            </p>
          </CardHeader>
          <CardContent>
            <DeleteAccountButton />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
