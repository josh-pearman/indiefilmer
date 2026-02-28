import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { getShootDayNumberMap } from "@/lib/schedule";
import { ShootDayList } from "@/components/schedule/shoot-day-list";

async function getAllShootDays() {
  const projectId = await requireCurrentProjectId();
  return prisma.shootDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    include: {
      location: { select: { name: true } },
      scenes: {
        orderBy: { sortOrder: "asc" },
        include: { scene: { select: { sceneNumber: true } } }
      }
    }
  });
}

async function getLocations() {
  const projectId = await requireCurrentProjectId();
  return prisma.location.findMany({
    where: { projectId, isDeleted: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}

async function getUnlinkedCateringDays() {
  const projectId = await requireCurrentProjectId();
  const days = await prisma.cateringDay.findMany({
    where: { projectId, isDeleted: false, shootDayId: null },
    orderBy: { date: "asc" },
    select: { id: true, date: true, label: true }
  });
  return days.map((d) => ({
    id: d.id,
    date: d.date ? d.date.toISOString().slice(0, 10) : "TBD",
    label: d.label
  }));
}

export default async function SchedulePage() {
  const projectId = await requireCurrentProjectId();
  const [days, locations, dayNumberMap, unlinkedCateringDays] = await Promise.all([
    getAllShootDays(),
    getLocations(),
    getShootDayNumberMap(projectId),
    getUnlinkedCateringDays()
  ]);

  const totalSceneAssignments = days
    .filter((d) => !d.isDeleted)
    .reduce((sum, d) => sum + d.scenes.length, 0);

  const listItems = days.map((day) => {
    const sceneNumbers = day.scenes
      .map((s) => s.scene.sceneNumber)
      .filter(Boolean);
    const notesPreview = day.notes
      ? day.notes.split("\n")[0]?.trim().slice(0, 80) ?? null
      : null;
    const dayNumber = dayNumberMap.get(day.id) ?? 0;

    return {
      id: day.id,
      date: day.date.toISOString(),
      dayNumber,
      locationName: day.location?.name ?? null,
      sceneCount: day.scenes.length,
      sceneNumbers,
      notesPreview,
      isDeleted: day.isDeleted ?? false
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shoot days and call sheets. Location-first: pick a day and location, then check which scenes you&apos;re shooting.
        </p>
      </div>

      <ShootDayList
        shootDays={listItems}
        totalSceneAssignments={totalSceneAssignments}
        locations={locations}
        unlinkedCateringDays={unlinkedCateringDays}
      />
    </div>
  );
}
