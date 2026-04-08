import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { localDate } from "@/lib/utils";
import { getShootDayNumberMap } from "@/lib/schedule";
import { getShotsForShootDay } from "@/actions/scenes";
import { ShotListPageClient } from "@/components/schedule/shot-list-page-client";
import { getShotlistGenerationMode } from "@/lib/shotlist-generate";

async function getShootDayWithScenes(id: string, projectId: string) {
  return prisma.shootDay.findFirst({
    where: { id, projectId, isDeleted: false },
    include: {
      location: { select: { name: true } },
      scenes: {
        orderBy: { sortOrder: "asc" },
        include: {
          scene: {
            select: {
              id: true,
              sceneNumber: true,
              title: true,
              intExt: true,
              dayNight: true,
              pageCount: true,
              synopsis: true,
              isDeleted: true
            }
          }
        }
      }
    }
  });
}

export default async function ShotListPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await requireCurrentProjectId();
  const [shootDay, dayNumberMap, shotListData] = await Promise.all([
    getShootDayWithScenes(id, projectId),
    getShootDayNumberMap(projectId),
    getShotsForShootDay(id)
  ]);

  if (!shootDay) notFound();

  const dayNumber = dayNumberMap.get(id) ?? 0;
  const dateStr = localDate(shootDay.date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });

  const scenes = shootDay.scenes
    .filter((s) => !s.scene.isDeleted)
    .map((s) => s.scene);

  // Build scene context for prompt generation
  const fullScenes = scenes.length > 0
    ? await prisma.scene.findMany({
        where: { id: { in: scenes.map((s) => s.id) }, isDeleted: false },
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

  const totalShotCount = shotsByScene.reduce(
    (sum, g) => sum + g.shots.length,
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/production/schedule/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Day {dayNumber}
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Shot List — Day {dayNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dateStr}
            {shootDay.location?.name ? ` · ${shootDay.location.name}` : ""}
            {` · ${scenes.length} scene${scenes.length !== 1 ? "s" : ""}`}
            {` · ${totalShotCount} shot${totalShotCount !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <ShotListPageClient
        shootDayId={id}
        dayNumber={dayNumber}
        scenes={scenes}
        shotsByScene={shotsByScene}
        shotlistSceneContext={shotlistSceneContext}
        sceneNumberToId={sceneNumberToId}
        totalShotCount={totalShotCount}
        generationMode={getShotlistGenerationMode()}
      />
    </div>
  );
}
