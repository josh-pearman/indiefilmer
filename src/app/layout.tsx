import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatWidget } from "@/components/chat/chat-widget";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCurrentProjectId, getUserProjectIds } from "@/lib/project";
import { isChatEnabled } from "@/lib/chat-provider";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const projectId = await getCurrentProjectId();
  const project = projectId
    ? await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true }
      })
    : null;
  const settings = projectId
    ? await prisma.projectSettings.findUnique({
        where: { projectId },
        select: { projectName: true }
      })
    : null;
  const projectName = settings?.projectName ?? project?.name ?? "Untitled Project";
  const title =
    projectName && projectName !== "Untitled Project"
      ? `iF | ${projectName}`
      : "iF | indieFilmer";
  return {
    title,
    description: "Microbudget Film Production Planner",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "indieFilmer",
    },
    icons: {
      apple: "/icons/icon-192x192.png",
    },
  };
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const userId = await getSessionUser();
  let projectId = await getCurrentProjectId();

  if (userId && !pathname.startsWith("/projects") && !pathname.startsWith("/login") && !pathname.startsWith("/setup") && !pathname.startsWith("/signup") && !pathname.startsWith("/verify") && !pathname.startsWith("/pending") && !pathname.startsWith("/admin") && !pathname.startsWith("/docs")) {
    if (!projectId) {
      const projectIds = await getUserProjectIds(userId);
      if (projectIds.length === 0) redirect("/projects/new");
      if (projectIds.length > 1) redirect("/projects");
      redirect(`/api/project/select?id=${projectIds[0]!}`);
    }
  }

  projectId = await getCurrentProjectId();
  const [project, settings, user, projectMember, sceneCount] = await Promise.all([
    projectId ? prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }) : null,
    projectId ? prisma.projectSettings.findUnique({ where: { projectId } }) : null,
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { colorTheme: true, name: true, username: true, email: true } }) : null,
    projectId && userId
      ? prisma.projectMember.findUnique({
          where: { userId_projectId: { userId, projectId } },
          select: { role: true, allowedSections: true }
        })
      : null,
    projectId ? prisma.scene.count({ where: { projectId, isDeleted: false } }) : 0
  ]);

  const projectName = settings?.projectName ?? project?.name ?? "Untitled Project";
  const theme = user?.colorTheme ?? "light";
  const displayName = user?.name ?? user?.username ?? user?.email ?? null;

  const authPages = ["/login", "/setup", "/signup", "/verify", "/pending", "/docs"];
  const isAuthPage = authPages.some((p) => pathname.startsWith(p));
  const showChrome = !!userId && !isAuthPage;

  return (
    <html lang="en" data-theme={theme}>
      <body
        className={cn(
          "min-h-screen bg-background text-foreground antialiased"
        )}
      >
        <ServiceWorkerRegister />
        <InstallPrompt />
        {showChrome ? (
          <div className="flex min-h-screen">
            <Sidebar
              projectName={projectName}
              displayName={displayName}
              projectMember={projectMember}
              isNewProject={sceneCount === 0}
            />
            <main className="flex-1 bg-background">
              <ScrollArea className="h-screen px-4 py-4 md:px-8 md:py-6">
                {children}
              </ScrollArea>
            </main>
            {isChatEnabled() && <ChatWidget />}
          </div>
        ) : (
          <main className="min-h-screen bg-background">
            {children}
          </main>
        )}
        <Toaster richColors closeButton position="bottom-right" />
      </body>
    </html>
  );
}
