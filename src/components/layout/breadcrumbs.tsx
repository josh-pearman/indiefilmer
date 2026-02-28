"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const SEGMENT_LABELS: Record<string, string> = {
  production: "Production Office",
  script: "Script & Story",
  talent: "Talent",
  accounting: "Accounting",
  locations: "Locations",
  gear: "Gear",
  catering: "Craft Services",
  schedule: "Schedule",
  tasks: "Tasks",
  notes: "Notes",
  hub: "Script Hub",
  scenes: "Scenes",
  "color-coded": "Color-Coded",
  cast: "Cast & Roles",
  crew: "Crew",
  contacts: "Contacts",
  budget: "Budget",
  expenses: "Expenses",
  "call-sheet": "Call Sheet",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [
    { label: "Home", href: "/" },
  ];

  let path = "";
  for (const segment of segments) {
    path += `/${segment}`;
    // Skip dynamic ID segments (UUIDs / cuid)
    if (/^[a-z0-9]{20,}$/i.test(segment) || /^[0-9a-f-]{36}$/i.test(segment)) {
      continue;
    }
    const label = SEGMENT_LABELS[segment] ?? segment;
    crumbs.push({ label, href: path });
  }

  // Don't render breadcrumbs for top-level department pages (only 2 crumbs: Home > Dept)
  if (crumbs.length <= 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            {isLast ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
