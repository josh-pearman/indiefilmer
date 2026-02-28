import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { getShootDayNumberMap } from "@/lib/schedule";
import { SceneList } from "@/components/scenes/scene-list";

async function getScenesAndLocations() {
  const projectId = await requireCurrentProjectId();
  const [scenes, locations, dayNumberMap] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId },
      orderBy: { sceneNumber: "asc" },
      include: {
        tags: true,
        location: { select: { id: true, name: true } },
        shootDayScenes: {
          where: { shootDay: { isDeleted: false } },
          include: { shootDay: { select: { id: true, date: true } } }
        }
      }
    }),
    prisma.location.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    getShootDayNumberMap(projectId)
  ]);

  const rows = scenes.map((s) => {
    const dayNumbers = s.shootDayScenes
      .map((sds) => dayNumberMap.get(sds.shootDay.id))
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    const scheduleSummary =
      dayNumbers.length === 0
        ? "Unscheduled"
        : dayNumbers.length === 1
          ? `Day ${dayNumbers[0]}`
          : `Days ${dayNumbers.join(", ")}`;
    const dates = s.shootDayScenes.map((sds) => sds.shootDay.date);
    const earliest =
      dates.length > 0
        ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString()
        : null;
    return {
      id: s.id,
      sceneNumber: s.sceneNumber,
      title: s.title,
      intExt: s.intExt,
      dayNight: s.dayNight,
      pageCount: s.pageCount,
      synopsis: s.synopsis,
      locationId: s.locationId,
      locationName: s.location?.name ?? null,
      isDeleted: s.isDeleted,
      shotlistPath: s.shotlistPath,
      tags: s.tags.map((t) => t.tag),
      earliestShootDate: earliest,
      scheduleSummary
    };
  });

  return { scenes: rows, locations };
}

export default async function ScenesPage() {
  const { scenes, locations } = await getScenesAndLocations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scenes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scene breakdown, tags, locations, and cast. Assign to shoot days from
          the Schedule.
        </p>
      </div>
      <SceneList scenes={scenes} locations={locations} />
    </div>
  );
}
