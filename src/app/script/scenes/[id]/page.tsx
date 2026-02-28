import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Users, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { getShootDayNumberMap } from "@/lib/schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SceneForm } from "@/components/scenes/scene-form";
import { SceneTags } from "@/components/scenes/scene-tags";
import { SceneCastList } from "@/components/scenes/scene-cast-list";
import { SceneScheduleInfo } from "@/components/scenes/scene-schedule-info";
import { SceneHistory } from "@/components/scenes/scene-history";
import { SceneDetailClient } from "@/components/scenes/scene-detail-client";
import { SceneShotlist } from "@/components/scenes/scene-shotlist";
import { cn } from "@/lib/utils";

async function getScene(id: string, projectId: string) {
  return prisma.scene.findFirst({
    where: { id, projectId },
    include: {
      tags: true,
      location: { select: { id: true, name: true } },
      castAssignments: { include: { castMember: true } }
    }
  });
}

async function getSceneShootDays(sceneId: string, projectId: string) {
  const links = await prisma.shootDayScene.findMany({
    where: { sceneId, shootDay: { projectId } },
    include: {
      shootDay: {
        include: { location: { select: { name: true } } }
      }
    },
    orderBy: { shootDay: { date: "asc" } }
  });
  const dayNumberMap = await getShootDayNumberMap(projectId);
  return links
    .filter((l) => !l.shootDay.isDeleted)
    .map((l) => ({
      id: l.shootDay.id,
      date: l.shootDay.date,
      callTime: l.shootDay.callTime,
      status: l.shootDay.status,
      locationName: l.shootDay.location?.name ?? null,
      dayNumber: dayNumberMap.get(l.shootDay.id) ?? 0
    }));
}

async function getSceneAuditLog(sceneId: string, limit: number, projectId: string) {
  return prisma.auditLog.findMany({
    where: { projectId, entityType: "Scene", entityId: sceneId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

async function getLocationsAndCast(projectId: string) {
  const [locations, cast] = await Promise.all([
    prisma.location.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.castMember.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true, roleName: true, actorName: true },
      orderBy: { name: "asc" }
    })
  ]);
  return { locations, cast };
}

export default async function SceneDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await requireCurrentProjectId();
  const [scene, shootDays, auditEntries, { locations, cast }] =
    await Promise.all([
      getScene(id, projectId),
      getSceneShootDays(id, projectId),
      getSceneAuditLog(id, 50, projectId),
      getLocationsAndCast(projectId)
    ]);

  if (!scene) notFound();

  const defaultFormValues = {
    sceneNumber: scene.sceneNumber,
    title: scene.title ?? "",
    intExt: scene.intExt ?? "",
    dayNight: scene.dayNight ?? "",
    pageCount:
      scene.pageCount != null ? String(scene.pageCount) : "",
    synopsis: scene.synopsis ?? "",
    locationId: scene.locationId ?? ""
  };

  return (
    <div className="space-y-6">
      <Link
        href="/script/scenes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Scenes
      </Link>

      {scene.isDeleted && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">This scene has been deleted.</span>{" "}
          <span className="inline-block">
            <SceneDetailClient
              sceneId={scene.id}
              action="restore"
              label="Restore"
            />
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight",
              scene.isDeleted && "line-through"
            )}
          >
            Scene {scene.sceneNumber}
            {scene.title ? ` — ${scene.title}` : ""}
          </h1>
          {scene.intExt && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {scene.intExt}
            </span>
          )}
          {scene.dayNight && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {scene.dayNight}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {scene.location && (
            <Link
              href={`/production/locations/${scene.location.id}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <MapPin className="h-3.5 w-3.5" />
              {scene.location.name}
            </Link>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {scene.castAssignments.length} cast member{scene.castAssignments.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {shootDays.length} shoot day{shootDays.length !== 1 ? "s" : ""}
          </span>
          {scene.pageCount != null && (
            <span>{scene.pageCount} page{scene.pageCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core info</CardTitle>
        </CardHeader>
        <CardContent>
          <SceneForm
            mode="edit"
            sceneId={scene.id}
            defaultValues={defaultFormValues}
            locations={locations}
            submitLabel="Save"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost / risk tags</CardTitle>
          <p className="text-sm text-muted-foreground">
            Toggle tags on or off. Changes save immediately.
          </p>
        </CardHeader>
        <CardContent>
          <SceneTags
            sceneId={scene.id}
            activeTags={scene.tags.map((t) => t.tag)}
          />
        </CardContent>
      </Card>

      <SceneShotlist sceneId={scene.id} shotlistPath={scene.shotlistPath} />

      <SceneCastList
        sceneId={scene.id}
        assigned={scene.castAssignments.map((a) => ({
          id: a.id,
          castMemberId: a.castMemberId,
          name: a.castMember.name,
          roleName: a.castMember.roleName,
          actorName: a.castMember.actorName
        }))}
        allCast={cast.map((c) => ({
          id: c.id,
          name: c.name,
          roleName: c.roleName,
          actorName: c.actorName
        }))}
      />

      <SceneScheduleInfo shootDays={shootDays} />

      <SceneHistory
        entries={auditEntries.map((e) => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          before: e.before,
          after: e.after,
          changeNote: e.changeNote,
          performedBy: e.performedBy,
          createdAt: e.createdAt
        }))}
        initialVisible={20}
      />

      {!scene.isDeleted && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Deleting this scene will remove it from all shoot day schedules.
            </p>
            <SceneDetailClient
              sceneId={scene.id}
              action="delete"
              label="Delete scene"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
