import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { isEmailEnabled } from "@/lib/email";
import { CastList } from "@/components/cast/cast-list";

async function getCast() {
  const projectId = await requireCurrentProjectId();
  const cast = await prisma.castMember.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: {
      sceneAssignments: {
        where: { scene: { isDeleted: false } },
        select: { id: true }
      }
    }
  });
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true }
  });
  return {
    projectName: project?.name ?? "Untitled Project",
    rows: cast.map((c) => ({
      id: c.id,
      name: c.name,
      roleName: c.roleName,
      actorName: c.actorName,
      email: c.email,
      notes: c.notes,
      status: c.status,
      rate: c.rate,
      days: c.days,
      flatFee: c.flatFee,
      budgetBucket: c.budgetBucket,
      isDeleted: c.isDeleted,
      intakeToken: c.intakeToken,
      sceneCount: c.sceneAssignments.length
    }))
  };
}

export default async function CastPage() {
  const { projectName, rows: cast } = await getCast();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Cast &amp; Roles
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cast members, roles, status, and cost estimates. Assign to scenes from
          the Scenes module.
        </p>
      </div>
      <CastList cast={cast} projectName={projectName} emailEnabled={isEmailEnabled()} />
    </div>
  );
}
