import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUCKET_NAMES = [
  "Locations",
  "Food",
  "Gear",
  "Talent",
  "Crew",
  "Transport",
  "Post",
  "Misc"
];

async function main() {
  const project = await prisma.project.create({
    data: { name: "Untitled Project" }
  });

  await prisma.projectSettings.create({
    data: {
      projectId: project.id,
      totalBudget: 10000,
      projectName: "Untitled Project",
      currencySymbol: "$"
    }
  });

  for (const name of BUCKET_NAMES) {
    await prisma.budgetBucket.create({
      data: {
        projectId: project.id,
        name,
        plannedAmount: 0
      }
    });
  }

  // Users are created via the setup flow or team management — not seeded.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
