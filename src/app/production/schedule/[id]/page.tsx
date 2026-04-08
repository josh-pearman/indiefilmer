import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { localDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getScenesForLocation, getSceneScheduleStatus, getShootDayNumberMap, type ShootDayInfo } from "@/lib/schedule";
import { ShootDayDetailClient } from "@/components/schedule/shoot-day-detail-client";
import { getShotsForShootDay } from "@/actions/scenes";

async function getShootDay(id: string, projectId: string) {
  return prisma.shootDay.findFirst({
    where: { id, projectId },
    include: {
      location: { select: { id: true, name: true } },
      scenes: {
        orderBy: { sortOrder: "asc" },
        include: { scene: { select: { id: true, sceneNumber: true, title: true, intExt: true, dayNight: true, pageCount: true, isDeleted: true } } }
      },
      crewMembers: { select: { crewMemberId: true } }
    }
  });
}

async function getLocations(projectId: string) {
  return prisma.location.findMany({
    where: { projectId, isDeleted: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}

async function getCrew(projectId: string) {
  return prisma.crewMember.findMany({
    where: { projectId, isDeleted: false },
    select: { id: true, name: true, position: true },
    orderBy: [{ position: "asc" }, { name: "asc" }]
  });
}

export default async function ShootDayDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await requireCurrentProjectId();
  const shootDay = await getShootDay(id, projectId);
  if (!shootDay) notFound();

  const locationId = shootDay.locationId ?? undefined;
  const assignedSceneIds = shootDay.scenes
    .filter((s) => !s.scene.isDeleted)
    .map((s) => s.scene.id);
  const assignedCrewIds = shootDay.crewMembers.map((c) => c.crewMemberId);

  const [locations, crew, dayNumberMap, scenesAtLocation, scheduleStatus, castForScenes, shotListData] = await Promise.all([
    getLocations(projectId),
    getCrew(projectId),
    getShootDayNumberMap(projectId),
    locationId ? getScenesForLocation(locationId, projectId) : Promise.resolve([]),
    assignedSceneIds.length > 0
      ? getSceneScheduleStatus(assignedSceneIds, projectId, { excludeShootDayId: id })
      : Promise.resolve(new Map()),
    assignedSceneIds.length > 0
      ? prisma.sceneCast.findMany({
          where: { sceneId: { in: assignedSceneIds } },
          include: { castMember: { select: { id: true, roleName: true, actorName: true, name: true } } }
        })
      : Promise.resolve([]),
    getShotsForShootDay(id)
  ]);

  const dayNumber = dayNumberMap.get(id) ?? 0;

  const scheduleStatusRecord: Record<string, Array<{ id: string; date: string; dayNumber: number }>> = {};
  scheduleStatus.forEach((days, sceneId) => {
    scheduleStatusRecord[sceneId] = days.map((d: ShootDayInfo) => ({
      id: d.id,
      date: d.date.toISOString(),
      dayNumber: d.dayNumber
    }));
  });

  const castNeeded = Array.from(
    new Map(
      castForScenes.map((c) => [
        c.castMemberId,
        {
          roleName: c.castMember.roleName ?? c.castMember.name ?? "—",
          actorName: c.castMember.actorName ?? null
        }
      ])
    ).values()
  );

  const totalPages = shootDay.scenes
    .filter((s) => !s.scene.isDeleted && s.scene.pageCount != null)
    .reduce((sum, s) => sum + (s.scene.pageCount ?? 0), 0);

  // Build scene context for shot list prompt generation
  const fullScenes = assignedSceneIds.length > 0
    ? await prisma.scene.findMany({
        where: { id: { in: assignedSceneIds }, isDeleted: false },
        include: {
          location: { select: { name: true } },
          tags: { select: { tag: true } },
          castAssignments: { include: { castMember: { select: { name: true } } } }
        }
      })
    : [];

  const shotlistSceneContext = fullScenes.map((s) => ({
    sceneNumber: s.sceneNumber,
    title: s.title,
    intExt: s.intExt,
    dayNight: s.dayNight,
    pageCount: s.pageCount,
    synopsis: s.synopsis,
    locationName: s.location?.name ?? null,
    characters: s.castAssignments.map((ca) => ca.castMember.name),
    tags: s.tags.map((t) => t.tag)
  }));

  const sceneNumberToId: Record<string, string> = {};
  for (const s of fullScenes) {
    sceneNumberToId[s.sceneNumber] = s.id;
  }

  // Flatten all shots to check if any exist
  const totalShotCount = shotListData.reduce(
    (sum, group) => sum + group.shots.length,
    0
  );

  // Serialize shots for the client
  const shotsByScene = shotListData.map((group) => ({
    scene: group.scene,
    shots: group.shots.map((shot) => ({
      id: shot.id,
      shotNumber: shot.shotNumber,
      shotSize: shot.shotSize,
      cameraAngle: shot.cameraAngle,
      cameraMovement: shot.cameraMovement,
      lens: shot.lens,
      description: shot.description,
      subjectOrFocus: shot.subjectOrFocus,
      notes: shot.notes,
      sortOrder: shot.sortOrder
    }))
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/production/schedule"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Schedule
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Shoot Day — {localDate(shootDay.date).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric"
            })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Edit details and assign scenes. Open the call sheet to print.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Link href={`/production/schedule/${id}/shot-list`}>
            <Button variant="outline">Shot List</Button>
          </Link>
          <Link href={`/production/schedule/${id}/call-sheet`}>
            <Button variant="default">View Call Sheet</Button>
          </Link>
        </div>
      </div>

      <ShootDayDetailClient
        shootDay={{
          id: shootDay.id,
          date: shootDay.date.toISOString().slice(0, 10),
          callTime: shootDay.callTime ?? "",
          locationId: shootDay.locationId ?? "",
          status: shootDay.status,
          notes: shootDay.notes ?? "",
          meals: shootDay.meals ?? 0,
          transport: shootDay.transport ?? 0,
          misc: shootDay.misc ?? 0,
          isDeleted: shootDay.isDeleted ?? false
        }}
        dayNumber={dayNumber}
        locationName={shootDay.location?.name ?? null}
        assignedSceneIds={assignedSceneIds}
        scenesAtLocation={scenesAtLocation}
        scheduleStatus={scheduleStatusRecord}
        locations={locations}
        castNeeded={castNeeded}
        totalPages={totalPages}
        crew={crew}
        assignedCrewIds={assignedCrewIds}
        shotlistSceneContext={shotlistSceneContext}
        sceneNumberToId={sceneNumberToId}
        shotsByScene={shotsByScene}
        totalShotCount={totalShotCount}
      />
    </div>
  );
}
