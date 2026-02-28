import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getScriptStats() {
  const projectId = await requireCurrentProjectId();

  const [currentScript, scenes] = await Promise.all([
    prisma.scriptVersion.findFirst({
      where: { projectId, isCurrent: true, isDeleted: false },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scene.findMany({
      where: { projectId, isDeleted: false },
      select: {
        id: true,
        shootDayScenes: {
          where: { shootDay: { isDeleted: false } },
          select: { id: true },
        },
      },
    }),
  ]);

  const totalScenes = scenes.length;
  const scheduled = scenes.filter((s) => s.shootDayScenes.length > 0).length;

  return { currentScript, totalScenes, scheduled };
}

export default async function ScriptLandingPage() {
  const data = await getScriptStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Script & Story</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Script versions, scenes, and the color-coded script.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Current Script</CardTitle></CardHeader>
          <CardContent>
            {data.currentScript ? (
              <>
                <p className="text-sm font-medium">{data.currentScript.versionName}</p>
                {data.currentScript.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{data.currentScript.notes}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No script uploaded yet.</p>
            )}
            <Link href="/script/hub" className="mt-2 inline-block text-xs text-primary hover:underline">
              Script Hub →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Scenes</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totalScenes}</p>
            <p className="text-xs text-muted-foreground">
              {data.scheduled} scheduled · {data.totalScenes - data.scheduled} unscheduled
            </p>
            <Link href="/script/scenes" className="mt-2 inline-block text-xs text-primary hover:underline">
              View scenes →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Color-Coded Script</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View a color-coded version of the script for at-a-glance scene tracking.
            </p>
            <Link href="/script/color-coded" className="mt-2 inline-block text-xs text-primary hover:underline">
              View color-coded →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
