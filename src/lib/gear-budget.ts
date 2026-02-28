import { prisma } from "./db";

/**
 * Returns the total estimated cost from all active gear models.
 * Used by the Budget module for the Gear bucket's estimated committed amount.
 */
export async function getActiveGearCost(projectId: string): Promise<number> {
  const models = await prisma.gearModel.findMany({
    where: { projectId, isActive: true, isDeleted: false },
    include: {
      items: {
        include: { daySelections: true }
      }
    }
  });

  let total = 0;
  for (const model of models) {
    for (const item of model.items) {
      if (item.costType === "flat_rate") {
        total += item.costAmount;
      } else {
        const selectedDays = item.daySelections.filter((d) => d.selected).length;
        total += item.costAmount * selectedDays;
      }
    }
  }
  return total;
}
