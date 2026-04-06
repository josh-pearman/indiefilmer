import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPendingUsers } from "@/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApproveRejectButtons } from "@/components/admin/approve-reject-buttons";
import { PreApproveForm } from "@/components/admin/pre-approve-form";
import Link from "next/link";

export default async function AdminPage() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { siteRole: true }
  });
  if (user?.siteRole !== "superadmin") {
    redirect("/settings");
  }

  const pending = await listPendingUsers();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Settings
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pending approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Users who signed up and are waiting for approval.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pre-approve email</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Add an email address so they can log in immediately.
          </p>
        </CardHeader>
        <CardContent>
          <PreApproveForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users awaiting approval</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending users.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div>
                    <span className="font-medium">{u.email ?? u.username ?? u.id}</span>
                    {u.name && (
                      <span className="ml-2 text-sm text-muted-foreground">({u.name})</span>
                    )}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {u.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <ApproveRejectButtons userId={u.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
