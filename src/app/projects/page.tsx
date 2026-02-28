import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listProjects } from "@/actions/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectProjectButton } from "@/components/projects/select-project-button";
import Link from "next/link";

export default async function ProjectsPage() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const projects = await listProjects();

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a project to work in, or create a new one.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any projects yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <span className="font-medium">{p.name}</span>
                  <SelectProjectButton projectId={p.id} />
                </li>
              ))}
            </ul>
          )}
          <div className="pt-4">
            <Link
              href="/projects/new"
              className="text-primary underline hover:no-underline"
            >
              Create new project →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
