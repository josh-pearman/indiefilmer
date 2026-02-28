'use client';

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Settings, LogOut, ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CreateBackupButton } from "@/components/shared/create-backup-button";
import { logout } from "@/actions/auth";
import { hasAccess, parseAllowedSections, type SectionKey } from "@/lib/sections";

type NavItem = { href: string; label: string; section: SectionKey };

type DepartmentGroup = {
  label: string;
  href: string;
  /** If any of these sections are accessible, the department is visible */
  sections: SectionKey[];
  items: NavItem[];
};

type NavEntry = DepartmentGroup;

const NAV: NavEntry[] = [
  {
    label: "PRODUCTION OFFICE",
    href: "/production",
    sections: ["schedule", "tasks", "notes", "locations", "gear", "craft-services"],
    items: [
      { href: "/production/schedule", label: "Schedule", section: "schedule" },
      { href: "/production/tasks", label: "Tasks", section: "tasks" },
      { href: "/production/notes", label: "Notes", section: "notes" },
      { href: "/production/locations", label: "Locations", section: "locations" },
      { href: "/production/gear", label: "Gear", section: "gear" },
      { href: "/production/catering", label: "Craft Services", section: "craft-services" },
    ],
  },
  {
    label: "SCRIPT & STORY",
    href: "/script",
    sections: ["script", "scenes"],
    items: [
      { href: "/script/hub", label: "Script Hub", section: "script" },
      { href: "/script/scenes", label: "Scenes", section: "scenes" },
    ],
  },
  {
    label: "TALENT",
    href: "/talent",
    sections: ["cast", "crew", "contacts"],
    items: [
      { href: "/talent/cast", label: "Cast & Roles", section: "cast" },
      { href: "/talent/crew", label: "Crew", section: "crew" },
      { href: "/talent/contacts", label: "Contacts", section: "contacts" },
    ],
  },
  {
    label: "ACCOUNTING",
    href: "/accounting",
    sections: ["budget"],
    items: [
      { href: "/accounting/budget", label: "Budget", section: "budget" },
      { href: "/accounting/expenses", label: "Expenses", section: "budget" },
    ],
  },
];

type ProjectMemberLike = { role: string; allowedSections: string } | null;

function canAccessAny(member: ProjectMemberLike, sections: SectionKey[]): boolean {
  if (!member || member.role === "admin") return true;
  const allowed = parseAllowedSections(member.allowedSections);
  return sections.some((s) => allowed.includes(s));
}

function NavLinks({
  onNavigate,
  projectMember,
  isNewProject = false
}: {
  onNavigate?: () => void;
  projectMember: ProjectMemberLike;
  isNewProject?: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = !projectMember || projectMember.role === "admin";

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto">
      {NAV.map((entry) => {
        if (!canAccessAny(projectMember, entry.sections)) return null;
        const deptActive = pathname.startsWith(entry.href);
        const visibleItems = isAdmin
          ? entry.items
          : entry.items.filter((item) => hasAccess(projectMember!, item.section));

        return (
          <div key={entry.href} className="mt-3 first:mt-0">
            <Link
              href={entry.href}
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                deptActive
                  ? "text-primary"
                  : "text-muted-foreground/70 hover:text-muted-foreground"
              )}
            >
              {entry.label}
            </Link>
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const showHint = isNewProject && item.href === "/script/scenes" && !isActive;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center justify-between rounded-md py-1.5 pl-6 pr-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {showHint ? (
                    <span className="rounded bg-yellow-100 px-1 py-0.5 text-muted-foreground dark:bg-yellow-900/40">
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                  {showHint && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                      <ArrowLeft className="h-3 w-3" />
                      Start here
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

type SidebarProps = {
  projectName?: string;
  displayName?: string | null;
  projectMember?: ProjectMemberLike;
  isNewProject?: boolean;
};

export function Sidebar({ projectName, displayName, projectMember = null, isNewProject = false }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const showSubtitle =
    projectName &&
    projectName.trim() !== "" &&
    projectName !== "Untitled Project";
  const showSettings = !projectMember || projectMember.role === "admin";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar no-print hidden h-screen w-64 flex-col border-r border-border bg-secondary/40 px-4 py-4 md:flex">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/">
            <div className="text-lg font-semibold tracking-tight hover:text-primary transition-colors">
              indieFilmer
            </div>
            {showSubtitle && (
              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                {projectName}
              </div>
            )}
          </Link>
        </div>
        <NavLinks projectMember={projectMember} isNewProject={isNewProject} />
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <a
            href="/docs"
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Docs
          </a>
          {showSettings && (
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          )}
          <CreateBackupButton />
          {displayName && (
            <form action={logout} className="mt-1">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="h-4 w-4" />
                {displayName} · Log out
              </button>
            </form>
          )}
        </div>
      </aside>

      {/* Mobile header with sheet sidebar */}
      <header className="no-print flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Link href="/">
          <div className="text-lg font-semibold tracking-tight hover:text-primary transition-colors">
            indieFilmer
          </div>
          {showSubtitle && (
            <div className="text-xs text-muted-foreground truncate">
              {projectName}
            </div>
          )}
        </Link>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <div className="flex h-full flex-col gap-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="text-base font-semibold tracking-tight">
                Navigation
              </div>
              <NavLinks projectMember={projectMember} isNewProject={isNewProject} onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto flex flex-col gap-2 pt-4">
                <a
                  href="/docs"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <BookOpen className="h-4 w-4" />
                  Docs
                </a>
                {showSettings && (
                  <Link
                    href="/settings"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                )}
                <CreateBackupButton />
                {displayName && (
                  <form action={logout}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      {displayName} · Log out
                    </button>
                  </form>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
