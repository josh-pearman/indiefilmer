import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { LineItemsList } from "@/components/budget-line-items/line-items-list";
import type { LineItemRowData } from "@/components/budget-line-items/line-item-row";
import type { SourceOption } from "@/components/budget-line-items/line-item-form";

async function getData() {
  const projectId = await requireCurrentProjectId();
  const [items, buckets, locations, shootDays, cast, crew, gearModels] =
    await Promise.all([
      prisma.budgetLineItem.findMany({
        where: { projectId },
        include: { bucket: true },
        orderBy: { date: "desc" }
      }),
      prisma.budgetBucket.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
      prisma.location.findMany({
        where: { projectId, isDeleted: false },
        select: { id: true, name: true }
      }),
      prisma.shootDay.findMany({
        where: { projectId, isDeleted: false },
        select: { id: true, date: true }
      }),
      prisma.castMember.findMany({
        where: { projectId, isDeleted: false },
        select: { id: true, name: true }
      }),
      prisma.crewMember.findMany({
        where: { projectId, isDeleted: false },
        select: { id: true, name: true }
      }),
      prisma.gearModel.findMany({
        where: { projectId, isDeleted: false },
        select: { id: true, name: true }
      })
    ]);

  const lineItems: LineItemRowData[] = items.map((i) => ({
    id: i.id,
    bucketId: i.bucketId,
    bucketName: i.bucket.name,
    description: i.description,
    plannedAmount: i.plannedAmount,
    actualAmount: i.actualAmount,
    date: i.date?.toISOString() ?? null,
    notes: i.notes,
    receiptPath: i.receiptPath,
    isDeleted: i.isDeleted
  }));

  const sourceOptions: SourceOption[] = [
    ...locations.map((l) => ({
      type: "Location",
      id: l.id,
      label: l.name
    })),
    ...shootDays.map((d) => ({
      type: "ShootDay",
      id: d.id,
      label: `Shoot day ${d.date.toISOString().slice(0, 10)}`
    })),
    ...cast.map((c) => ({
      type: "CastMember",
      id: c.id,
      label: c.name
    })),
    ...crew.map((c) => ({
      type: "CrewMember",
      id: c.id,
      label: c.name
    })),
    ...gearModels.map((g) => ({
      type: "GearModel",
      id: g.id,
      label: g.name
    }))
  ];

  return {
    lineItems,
    buckets: buckets.map((b) => ({ id: b.id, name: b.name })),
    sourceOptions
  };
}

export default async function BudgetLineItemsPage() {
  const { lineItems, buckets, sourceOptions } = await getData();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Budget Line Items</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track individual expenses against budget buckets.
        </p>
      </div>
      <LineItemsList
        items={lineItems}
        buckets={buckets}
        sourceOptions={sourceOptions}
      />
    </div>
  );
}
