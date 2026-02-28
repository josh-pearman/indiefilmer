import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { isEmailEnabled } from "@/lib/email";
import { CrewList } from "@/components/crew/crew-list";

async function getCrewData() {
  const projectId = await requireCurrentProjectId();
  const crew = await prisma.crewMember.findMany({
    where: { projectId },
    orderBy: { name: "asc" }
  });
  const positions = [...new Set(crew.map((c) => c.position))].sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    crew: crew.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      email: c.email,
      notes: c.notes,
      status: c.status,
      rate: c.rate,
      days: c.days,
      flatFee: c.flatFee,
      budgetBucket: c.budgetBucket,
      isDeleted: c.isDeleted,
      intakeToken: c.intakeToken
    })),
    positions
  };
}

export default async function CrewPage() {
  const projectId = await requireCurrentProjectId();
  const [{ crew, positions }, project] = await Promise.all([
    getCrewData(),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Crew</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crew members, positions, status, and cost estimates. Assign to call
          sheets from the Schedule.
        </p>
      </div>
      <CrewList crew={crew} positions={positions} projectName={project?.name ?? "Untitled Project"} emailEnabled={isEmailEnabled()} />
    </div>
  );
}
