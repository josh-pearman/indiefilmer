import { prisma } from "@/lib/db";
import { getCurrentProjectId } from "@/lib/project";
import { localDate } from "@/lib/utils";
import { ensureShootDayMeals } from "@/actions/craft-services";
import { CraftServicesGrid, type CraftServicesDay, type DietaryEntry } from "@/components/craft-services/craft-services-grid";

async function getCraftServicesData(projectId: string | null) {
  if (!projectId) return { days: [], totalEstimated: 0, totalActual: 0 };
  const [shootDays, standaloneDays, settings] = await Promise.all([
    prisma.shootDay.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { date: "asc" },
      include: {
        location: { select: { name: true } },
        linkedCateringDay: { select: { id: true } },
        scenes: {
          include: {
            scene: {
              include: {
                castAssignments: {
                  include: { castMember: true }
                }
              }
            }
          }
        }
      }
    }),
    prisma.cateringDay.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { date: "asc" },
      include: { meals: true }
    }),
    prisma.projectSettings.findUnique({ where: { projectId } })
  ]);

  const craftyPerPerson = settings?.craftyPerPerson ?? 5;
  const lunchPerPerson = settings?.lunchPerPerson ?? 12;
  const dinnerPerPerson = settings?.dinnerPerPerson ?? 12;

  // Shoot day meals
  const shootDayIds = shootDays.map((sd) => sd.id);
  const allMeals =
    shootDayIds.length > 0
      ? await prisma.shootDayMeal.findMany({
          where: { shootDayId: { in: shootDayIds } },
          orderBy: { mealType: "asc" }
        })
      : [];
  const mealsByDayId = allMeals.reduce<Record<string, typeof allMeals>>((acc, m) => {
    if (!acc[m.shootDayId]) acc[m.shootDayId] = [];
    acc[m.shootDayId].push(m);
    return acc;
  }, {});

  // Per-day crew assignments
  const allCrewAssignments =
    shootDayIds.length > 0
      ? await prisma.shootDayCrew.findMany({
          where: { shootDayId: { in: shootDayIds } },
          include: {
            crewMember: {
              select: { name: true, dietaryRestrictions: true }
            }
          }
        })
      : [];
  const crewAssignmentsByDayId = allCrewAssignments.reduce<
    Record<string, typeof allCrewAssignments>
  >((acc, a) => {
    if (!acc[a.shootDayId]) acc[a.shootDayId] = [];
    acc[a.shootDayId].push(a);
    return acc;
  }, {});

  // Build shoot day entries (skip if linked to a CateringDay — that one takes over)
  const linkedCateringDayIds = new Set(
    standaloneDays.filter((cd) => cd.shootDayId).map((cd) => cd.shootDayId!)
  );
  const days: CraftServicesDay[] = [];
  let shootDayIndex = 0;

  for (const sd of shootDays) {
    shootDayIndex++;
    // If this shoot day has a linked CateringDay, skip — the CateringDay entry will represent it
    if (linkedCateringDayIds.has(sd.id)) continue;

    let mealsList = mealsByDayId[sd.id] ?? [];
    if (mealsList.length === 0) {
      await ensureShootDayMeals(sd.id);
      mealsList = await prisma.shootDayMeal.findMany({
        where: { shootDayId: sd.id }
      });
    }
    const castIds = new Set<string>();
    const dietaryEntries: DietaryEntry[] = [];
    for (const sds of sd.scenes) {
      for (const a of sds.scene.castAssignments) {
        if (!a.castMember.isDeleted && !castIds.has(a.castMember.id)) {
          castIds.add(a.castMember.id);
          if (
            a.castMember.dietaryRestrictions &&
            a.castMember.dietaryRestrictions.trim() !== ""
          ) {
            dietaryEntries.push({
              name: a.castMember.name ?? "Unknown",
              restrictions: a.castMember.dietaryRestrictions,
            });
          }
        }
      }
    }
    const castCount = castIds.size;
    const dayCrewAssignments = crewAssignmentsByDayId[sd.id] ?? [];
    const crewCount = dayCrewAssignments.length;
    for (const a of dayCrewAssignments) {
      if (
        a.crewMember.dietaryRestrictions &&
        a.crewMember.dietaryRestrictions.trim() !== ""
      ) {
        dietaryEntries.push({
          name: a.crewMember.name,
          restrictions: a.crewMember.dietaryRestrictions,
        });
      }
    }
    const totalHeadcount = castCount + crewCount;
    const defaultEstimatedCosts = {
      crafty: totalHeadcount * craftyPerPerson,
      lunch: totalHeadcount * lunchPerPerson,
      dinner: totalHeadcount * dinnerPerPerson
    };
    days.push({
      id: sd.id,
      dayLabel: `Day ${shootDayIndex}`,
      dateFormatted: localDate(sd.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
      sortDate: sd.date,
      locationName: sd.location?.name ?? "TBD",
      castCount,
      crewCount,
      totalHeadcount,
      dietaryEntries,
      meals: mealsList.map((m) => ({
        id: m.id,
        mealType: m.mealType,
        enabled: m.enabled,
        vendor: m.vendor,
        estimatedCost: m.estimatedCost,
        actualCost: m.actualCost,
        notes: m.notes
      })),
      defaultEstimatedCosts
    });
  }

  // Build standalone / linked catering day entries
  for (const cd of standaloneDays) {
    const isLinked = cd.shootDayId != null;
    // For linked days, find the shoot day to get cast/crew/location data
    const linkedShootDay = isLinked
      ? shootDays.find((sd) => sd.id === cd.shootDayId)
      : null;

    let castCount = 0;
    let crewCount = 0;
    let totalHeadcount = cd.headcount;
    let locationName = cd.locationName ?? "TBD";
    const dietaryEntries: DietaryEntry[] = [];
    let dayLabel = cd.label;

    if (linkedShootDay) {
      const castIds = new Set<string>();
      for (const sds of linkedShootDay.scenes) {
        for (const a of sds.scene.castAssignments) {
          if (!a.castMember.isDeleted && !castIds.has(a.castMember.id)) {
            castIds.add(a.castMember.id);
            if (
              a.castMember.dietaryRestrictions &&
              a.castMember.dietaryRestrictions.trim() !== ""
            ) {
              dietaryEntries.push({
                name: a.castMember.name ?? "Unknown",
                restrictions: a.castMember.dietaryRestrictions,
              });
            }
          }
        }
      }
      castCount = castIds.size;
      const linkedCrewAssignments = crewAssignmentsByDayId[linkedShootDay.id] ?? [];
      crewCount = linkedCrewAssignments.length;
      for (const a of linkedCrewAssignments) {
        if (
          a.crewMember.dietaryRestrictions &&
          a.crewMember.dietaryRestrictions.trim() !== ""
        ) {
          dietaryEntries.push({
            name: a.crewMember.name,
            restrictions: a.crewMember.dietaryRestrictions,
          });
        }
      }
      totalHeadcount = castCount + crewCount;
      locationName = linkedShootDay.location?.name ?? locationName;
      // Find the shoot day's index for labeling
      const sdIndex = shootDays.indexOf(linkedShootDay);
      dayLabel = `Day ${sdIndex + 1} — ${cd.label}`;
    }

    const defaultEstimatedCosts = {
      crafty: totalHeadcount * craftyPerPerson,
      lunch: totalHeadcount * lunchPerPerson,
      dinner: totalHeadcount * dinnerPerPerson
    };

    days.push({
      id: cd.id,
      dayLabel,
      dateFormatted: cd.date
        ? localDate(cd.date).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
          })
        : "TBD",
      sortDate: cd.date ?? null,
      locationName,
      castCount,
      crewCount,
      totalHeadcount,
      dietaryEntries,
      meals: cd.meals.map((m) => ({
        id: m.id,
        mealType: m.mealType,
        enabled: m.enabled,
        vendor: m.vendor,
        estimatedCost: m.estimatedCost,
        actualCost: m.actualCost,
        notes: m.notes
      })),
      defaultEstimatedCosts,
      isStandalone: true,
      headcount: cd.headcount,
      linkedShootDayId: cd.shootDayId ?? undefined
    });
  }

  // Sort all by date (TBD dates go to end)
  days.sort((a, b) => {
    if (!a.sortDate && !b.sortDate) return 0;
    if (!a.sortDate) return 1;
    if (!b.sortDate) return -1;
    return new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime();
  });

  const totalEstimated = days.reduce((sum, d) => {
    return (
      sum +
      d.meals
        .filter((m) => m.enabled)
        .reduce((s, m) => s + (m.estimatedCost ?? 0), 0)
    );
  }, 0);
  const totalActual = days.reduce((sum, d) => {
    return (
      sum +
      d.meals
        .filter((m) => m.enabled)
        .reduce((s, m) => s + (m.actualCost ?? 0), 0)
    );
  }, 0);

  return { days, totalEstimated, totalActual };
}

export default async function CraftServicesPage() {
  const projectId = await getCurrentProjectId();
  const { days, totalEstimated, totalActual } = await getCraftServicesData(projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Craft Services</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-day meal planning, headcounts, and dietary tracking.
        </p>
      </div>
      <CraftServicesGrid
        days={days}
        totalEstimated={totalEstimated}
        totalActual={totalActual}
      />
    </div>
  );
}
