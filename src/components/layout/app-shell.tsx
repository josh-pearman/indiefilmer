"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

type AppShellProps = {
  projectName: string;
  displayName: string | null;
  projectMember: { role: string; allowedSections: string } | null;
  isNewProject: boolean;
  children: React.ReactNode;
};

export function AppShell({
  projectName,
  displayName,
  projectMember,
  isNewProject,
  children
}: AppShellProps) {
  const pathname = usePathname();
  const isFullScreen = pathname.endsWith("/shot-list");

  if (isFullScreen) {
    return (
      <main className="min-h-screen bg-background">
        <div className="h-screen px-4 py-4 md:px-6 md:py-4 overflow-auto">
          {children}
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        projectName={projectName}
        displayName={displayName}
        projectMember={projectMember}
        isNewProject={isNewProject}
      />
      <main className="flex-1 bg-background">
        <ScrollArea className="h-screen px-4 py-4 md:px-8 md:py-6">
          {children}
        </ScrollArea>
      </main>
    </div>
  );
}
