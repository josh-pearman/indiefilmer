import { prisma } from "@/lib/db";
import { getCurrentProjectId } from "@/lib/project";
import { ensureGearItemDays } from "@/actions/gear";
import { GearPage } from "@/components/gear/gear-page";

async function getGearPageData(projectId: string | null) {
  if (!projectId) return { shootDays: [], models: [], globalTotalBudget: 10000 };
  await ensureGearItemDays();

  const [shootDays, models, projectSettings] = await Promise.all([
    prisma.shootDay.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { date: "asc" },
      select: { id: true, date: true }
    }),
    prisma.gearModel.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { daySelections: true }
        }
      }
    }),
    prisma.projectSettings.findUnique({
      where: { projectId }
    })
  ]);

  const globalTotalBudget = projectSettings?.totalBudget ?? 10000;

  const shootDaysForGear = shootDays.map((d) => ({
    id: d.id,
    date: d.date.toISOString().slice(0, 10),
    label: d.date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    })
  }));

  const modelsForCards = models.map((m) => ({
    id: m.id,
    name: m.name,
    isActive: m.isActive,
    plannedAmount: m.plannedAmount,
    items: m.items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      costAmount: i.costAmount,
      costType: i.costType as "per_day" | "flat_rate",
      supplier: i.supplier,
      daySelections: i.daySelections.map((d) => ({
        shootDayId: d.shootDayId,
        selected: d.selected
      }))
    }))
  }));

  return {
    shootDays: shootDaysForGear,
    models: modelsForCards,
    globalTotalBudget
  };
}

export default async function GearRoute() {
  const projectId = await getCurrentProjectId();
  const data = await getGearPageData(projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gear</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage gear models, items, and per-day rental selections.
        </p>
      </div>
      <GearPage
        shootDays={data.shootDays}
        models={data.models}
        globalTotalBudget={data.globalTotalBudget}
      />
    </div>
  );
}
