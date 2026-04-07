import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserProjectIds } from "@/lib/project";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import { logout } from "@/actions/auth";

export default async function NewProjectPage() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const projectIds = await getUserProjectIds(userId);
  const isFirstProject = projectIds.length === 0;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true, email: true }
  });
  const displayName = user?.name ?? user?.username ?? user?.email ?? "there";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6 shadow-card">
        {isFirstProject ? (
          <>
            <div>
              <h1 className="text-xl font-semibold">Welcome to indieFilmer</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Hey {displayName}! Create your first project to get started. You can manage cast, crew, scenes, schedules, budgets, and more.
              </p>
            </div>
            <CreateProjectForm />
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-semibold">New project</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a project to get started. You can add team members later from Settings.
              </p>
            </div>
            <CreateProjectForm />
            <a
              href="/projects"
              className="block text-center text-sm text-muted-foreground underline hover:no-underline"
            >
              Back to projects
            </a>
          </>
        )}
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
