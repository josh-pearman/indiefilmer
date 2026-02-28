import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { CreateProjectForm } from "@/components/projects/create-project-form";
import Link from "next/link";

export default async function NewProjectPage() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-8 py-8">
      <div>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Projects
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">New project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a project to get started. You can add team members later from Settings.
        </p>
      </div>

      <CreateProjectForm />
    </div>
  );
}
