import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getCurrentProjectId, getUserProjectIds } from "@/lib/project";

export const dynamic = 'force-dynamic';

const departments = [
  {
    name: "Production Office",
    href: "/production",
    links: [
      { label: "Schedule", href: "/production/schedule" },
      { label: "Tasks", href: "/production/tasks" },
      { label: "Notes", href: "/production/notes" },
      { label: "Locations", href: "/production/locations" },
      { label: "Gear", href: "/production/gear" },
      { label: "Craft Services", href: "/production/catering" },
    ],
  },
  {
    name: "Script & Story",
    href: "/script",
    links: [
      { label: "Script Hub", href: "/script/hub" },
      { label: "Scenes", href: "/script/scenes" },
      { label: "Color-Coded Script", href: "/script/color-coded" },
    ],
  },
  {
    name: "Talent",
    href: "/talent",
    links: [
      { label: "Cast & Roles", href: "/talent/cast" },
      { label: "Crew", href: "/talent/crew" },
      { label: "Contacts", href: "/talent/contacts" },
    ],
  },
  {
    name: "Accounting",
    href: "/accounting",
    links: [
      { label: "Budget", href: "/accounting/budget" },
      { label: "Expenses", href: "/accounting/expenses" },
    ],
  },
];

export default async function DashboardPage() {
  const userId = await getSessionUser();
  if (!userId) redirect("/login");

  const projectId = await getCurrentProjectId();
  if (!projectId) {
    const projectIds = await getUserProjectIds(userId);
    if (projectIds.length === 0) redirect("/projects/new");
    if (projectIds.length === 1) redirect(`/api/project/select?id=${projectIds[0]}`);
    redirect("/projects");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">indieFilmer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your film production at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {departments.map((dept) => (
          <Card key={dept.href}>
            <CardContent className="pt-5 pb-4">
              <Link
                href={dept.href}
                className="text-sm font-semibold hover:text-primary transition-colors"
              >
                {dept.name}
              </Link>
              <ul className="mt-2 space-y-1">
                {dept.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
