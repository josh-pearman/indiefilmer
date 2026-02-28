import { prisma } from "./db";

export type SceneForChecklist = {
  id: string;
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
  pageCount: number | null;
};

export type ShootDayInfo = {
  id: string;
  date: Date;
  dayNumber: number;
};

/** All non-deleted scenes for a location, ordered by scene number. */
export async function getScenesForLocation(
  locationId: string,
  projectId: string
): Promise<SceneForChecklist[]> {
  const scenes = await prisma.scene.findMany({
    where: { locationId, projectId, isDeleted: false },
    orderBy: { sceneNumber: "asc" },
    select: {
      id: true,
      sceneNumber: true,
      title: true,
      intExt: true,
      dayNight: true,
      pageCount: true
    }
  });
  return scenes;
}

/** Chronological order of all non-deleted shoot days → day number (1-based). */
export async function getShootDayNumberMap(projectId: string): Promise<Map<string, number>> {
  const days = await prisma.shootDay.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { date: "asc" },
    select: { id: true }
  });
  const map = new Map<string, number>();
  days.forEach((d, i) => map.set(d.id, i + 1));
  return map;
}

/** For each scene ID, which other shoot days it's assigned to (for "also on Day X" badges). */
export async function getSceneScheduleStatus(
  sceneIds: string[],
  projectId: string,
  options?: { excludeShootDayId?: string }
): Promise<Map<string, ShootDayInfo[]>> {
  if (sceneIds.length === 0) return new Map();
  const excludeId = options?.excludeShootDayId;

  const dayNumberMap = await getShootDayNumberMap(projectId);

  const links = await prisma.shootDayScene.findMany({
    where: { sceneId: { in: sceneIds }, shootDay: { projectId } },
    include: {
      shootDay: {
        select: { id: true, date: true, isDeleted: true }
      }
    }
  });

  const byScene = new Map<string, ShootDayInfo[]>();
  for (const link of links) {
    if (link.shootDay.isDeleted) continue;
    if (excludeId && link.shootDay.id === excludeId) continue;
    const dayNumber = dayNumberMap.get(link.shootDay.id);
    if (dayNumber == null) continue;
    const info: ShootDayInfo = {
      id: link.shootDay.id,
      date: link.shootDay.date,
      dayNumber
    };
    const list = byScene.get(link.sceneId) ?? [];
    list.push(info);
    byScene.set(link.sceneId, list);
  }
  // Sort each list by date
  byScene.forEach((list) =>
    list.sort((a, b) => a.date.getTime() - b.date.getTime())
  );
  return byScene;
}
