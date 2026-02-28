import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

const subpages = [
  { href: "/production/schedule", label: "Schedule", description: "Shoot days and call sheets" },
  { href: "/production/tasks", label: "Tasks", description: "Track to-dos and assignments" },
  { href: "/production/notes", label: "Notes", description: "Meeting notes and references" },
  { href: "/production/locations", label: "Locations", description: "Scouting and venue details" },
  { href: "/production/gear", label: "Gear", description: "Equipment and cost modeling" },
  { href: "/production/catering", label: "Craft Services", description: "Meals and crafty per shoot day" },
];

export default async function ProductionPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Production Office</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule, tasks, notes, locations, gear, and catering.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subpages.map((page) => (
          <Link key={page.href} href={page.href} className="group">
            <Card className="transition-colors group-hover:border-primary/40">
              <CardContent className="pt-5 pb-4">
                <p className="text-sm font-semibold group-hover:text-primary transition-colors">
                  {page.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {page.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
