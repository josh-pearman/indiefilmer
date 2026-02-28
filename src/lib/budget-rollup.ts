import { prisma } from "./db";
import { getActiveGearCost } from "./gear-budget";

export type BudgetRollupBucket = {
  id: string;
  name: string;
  planned: number;
  entityPlanned: number;
  estimatedCommitted: number;
  actualSpent: number;
  delta: number;
};

export type TopCostDriver = {
  name: string;
  type: string;
  sourceId: string;
  estimatedCost: number;
  bucket: string;
};

export type BudgetRollupData = {
  totalBudget: number;
  currencySymbol: string;
  buckets: BudgetRollupBucket[];
  topCostDrivers: TopCostDriver[];
  summary: {
    totalPlanned: number;
    totalEntityPlanned: number;
    totalEstimated: number;
    totalActual: number;
    remaining: number;
    unallocated: number;
  };
};

function defaultBucketForType(
  type: "Location" | "CastMember" | "CrewMember" | "ShootDay"
): string {
  switch (type) {
    case "Location":
      return "Locations";
    case "CastMember":
      return "Talent";
    case "CrewMember":
      return "Crew";
    case "ShootDay":
      return "Transport";
    default:
      return "Misc";
  }
}

export async function calculateBudgetRollup(projectId: string): Promise<BudgetRollupData> {
  const [settings, buckets, locations, cast, crew, shootDays, meals, standaloneMeals, lineItemsAgg] =
    await Promise.all([
      prisma.projectSettings.findUnique({ where: { projectId } }),
      prisma.budgetBucket.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
      prisma.location.findMany({
        where: { projectId, isDeleted: false },
        select: {
          id: true,
          name: true,
          estimatedCostPerDay: true,
          numberOfDays: true,
          fees: true,
          plannedAmount: true,
          budgetBucket: true
        }
      }),
      prisma.castMember.findMany({
        where: { projectId, isDeleted: false },
        select: {
          id: true,
          name: true,
          rate: true,
          days: true,
          flatFee: true,
          plannedAmount: true,
          budgetBucket: true
        }
      }),
      prisma.crewMember.findMany({
        where: { projectId, isDeleted: false },
        select: {
          id: true,
          name: true,
          rate: true,
          days: true,
          flatFee: true,
          plannedAmount: true,
          budgetBucket: true
        }
      }),
      prisma.shootDay.findMany({
        where: { projectId, isDeleted: false },
        select: { id: true, date: true, transport: true, budgetBucket: true }
      }),
      prisma.shootDayMeal.findMany({
        where: { shootDay: { projectId, isDeleted: false }, enabled: true },
        select: { estimatedCost: true }
      }),
      prisma.cateringDayMeal.findMany({
        where: { cateringDay: { projectId, isDeleted: false }, enabled: true },
        select: { estimatedCost: true }
      }),
      prisma.budgetLineItem.groupBy({
        by: ["bucketId"],
        where: { projectId, isDeleted: false },
        _sum: { actualAmount: true }
      })
    ]);

  const totalBudget = settings?.totalBudget ?? 10000;
  const currencySymbol = settings?.currencySymbol ?? "$";
  const bucketByName = new Map(buckets.map((b) => [b.name, b]));
  const actualByBucketId = new Map(
    lineItemsAgg.map((g) => [g.bucketId, g._sum.actualAmount ?? 0])
  );

  const gearTotal = await getActiveGearCost(projectId);
  const gearModelsForPlanned = await prisma.gearModel.findMany({
    where: { projectId, isActive: true, isDeleted: false },
    select: { plannedAmount: true }
  });

  const drivers: TopCostDriver[] = [];

  const estimatedByBucketName = new Map<string, number>();
  const entityPlannedByBucketName = new Map<string, number>();
  for (const b of buckets) {
    estimatedByBucketName.set(b.name, 0);
    entityPlannedByBucketName.set(b.name, 0);
  }

  for (const loc of locations) {
    const bucket = loc.budgetBucket ?? "Locations";
    if (loc.plannedAmount != null && loc.plannedAmount > 0) {
      entityPlannedByBucketName.set(
        bucket,
        (entityPlannedByBucketName.get(bucket) ?? 0) + loc.plannedAmount
      );
    }
    const days = loc.numberOfDays ?? 0;
    const perDay = loc.estimatedCostPerDay ?? 0;
    const fees = loc.fees ?? 0;
    const cost = perDay * days + fees;
    if (cost > 0) {
      estimatedByBucketName.set(
        bucket,
        (estimatedByBucketName.get(bucket) ?? 0) + cost
      );
      drivers.push({
        name: loc.name,
        type: "Location",
        sourceId: loc.id,
        estimatedCost: cost,
        bucket
      });
    }
  }

  let foodEstimated = 0;
  for (const m of meals) {
    foodEstimated += m.estimatedCost ?? 0;
  }
  for (const m of standaloneMeals) {
    foodEstimated += m.estimatedCost ?? 0;
  }
  if (foodEstimated > 0) {
    estimatedByBucketName.set(
      "Food",
      (estimatedByBucketName.get("Food") ?? 0) + foodEstimated
    );
    drivers.push({
      name: "Craft Services",
      type: "CraftServices",
      sourceId: "",
      estimatedCost: foodEstimated,
      bucket: "Food"
    });
  }

  estimatedByBucketName.set(
    "Gear",
    (estimatedByBucketName.get("Gear") ?? 0) + gearTotal
  );
  if (gearTotal > 0) {
    drivers.push({
      name: "Gear (Active Models)",
      type: "GearModel",
      sourceId: "",
      estimatedCost: gearTotal,
      bucket: "Gear"
    });
  }
  for (const gm of gearModelsForPlanned) {
    if (gm.plannedAmount != null && gm.plannedAmount > 0) {
      entityPlannedByBucketName.set(
        "Gear",
        (entityPlannedByBucketName.get("Gear") ?? 0) + gm.plannedAmount
      );
    }
  }

  for (const c of cast) {
    const bucket = c.budgetBucket ?? "Talent";
    if (c.plannedAmount != null && c.plannedAmount > 0) {
      entityPlannedByBucketName.set(
        bucket,
        (entityPlannedByBucketName.get(bucket) ?? 0) + c.plannedAmount
      );
    }
    const cost =
      c.flatFee ?? (c.rate != null && c.days != null ? c.rate * c.days : 0);
    if (cost > 0) {
      estimatedByBucketName.set(
        bucket,
        (estimatedByBucketName.get(bucket) ?? 0) + cost
      );
      drivers.push({
        name: c.name,
        type: "CastMember",
        sourceId: c.id,
        estimatedCost: cost,
        bucket
      });
    }
  }

  for (const c of crew) {
    const bucket = c.budgetBucket ?? "Crew";
    if (c.plannedAmount != null && c.plannedAmount > 0) {
      entityPlannedByBucketName.set(
        bucket,
        (entityPlannedByBucketName.get(bucket) ?? 0) + c.plannedAmount
      );
    }
    const cost =
      c.flatFee ?? (c.rate != null && c.days != null ? c.rate * c.days : 0);
    if (cost > 0) {
      estimatedByBucketName.set(
        bucket,
        (estimatedByBucketName.get(bucket) ?? 0) + cost
      );
      drivers.push({
        name: c.name,
        type: "CrewMember",
        sourceId: c.id,
        estimatedCost: cost,
        bucket
      });
    }
  }

  for (const day of shootDays) {
    const t = day.transport ?? 0;
    if (t > 0) {
      const bucket = day.budgetBucket ?? "Transport";
      estimatedByBucketName.set(
        bucket,
        (estimatedByBucketName.get(bucket) ?? 0) + t
      );
      drivers.push({
        name: `Shoot Day ${day.date.toISOString().slice(0, 10)}`,
        type: "ShootDay",
        sourceId: day.id,
        estimatedCost: t,
        bucket
      });
    }
  }

  drivers.sort((a, b) => b.estimatedCost - a.estimatedCost);
  const topCostDrivers = drivers.slice(0, 5);

  const bucketRows: BudgetRollupBucket[] = buckets.map((b) => {
    const planned = b.plannedAmount ?? 0;
    const entityPlanned = entityPlannedByBucketName.get(b.name) ?? 0;
    const estimatedCommitted = estimatedByBucketName.get(b.name) ?? 0;
    const actualSpent = actualByBucketId.get(b.id) ?? 0;
    const delta = planned - estimatedCommitted;
    return {
      id: b.id,
      name: b.name,
      planned,
      entityPlanned,
      estimatedCommitted,
      actualSpent,
      delta
    };
  });

  const totalPlanned = bucketRows.reduce((s, r) => s + r.planned, 0);
  const totalEntityPlanned = bucketRows.reduce((s, r) => s + r.entityPlanned, 0);
  const totalEstimated = bucketRows.reduce((s, r) => s + r.estimatedCommitted, 0);
  const totalActual = bucketRows.reduce((s, r) => s + r.actualSpent, 0);
  const remaining = totalBudget - totalActual;
  const unallocated = totalBudget - totalPlanned;

  return {
    totalBudget,
    currencySymbol,
    buckets: bucketRows,
    topCostDrivers,
    summary: {
      totalPlanned,
      totalEntityPlanned,
      totalEstimated,
      totalActual,
      remaining,
      unallocated
    }
  };
}
