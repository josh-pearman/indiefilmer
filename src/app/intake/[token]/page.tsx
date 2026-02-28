import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { IntakeForm } from "@/components/intake/intake-form";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Look up the token in both CastMember and CrewMember tables
  const [castMember, crewMember] = await Promise.all([
    prisma.castMember.findUnique({
      where: { intakeToken: token },
      include: { project: true },
    }),
    prisma.crewMember.findUnique({
      where: { intakeToken: token },
      include: { project: true },
    }),
  ]);

  const record = castMember ?? crewMember;
  if (!record || !record.project) {
    notFound();
  }

  const isCast = !!castMember;
  const projectName = record.project.name;

  // For cast: display name is actorName, roleName is the character/role (the name field)
  // For crew: display name is name, roleName is the position field
  const displayName = isCast ? (castMember.actorName ?? "") : crewMember!.name;
  const roleName = isCast ? castMember.name : crewMember!.position;

  return (
    <IntakeForm
      token={token}
      projectName={projectName}
      roleName={roleName}
      defaultValues={{
        name: displayName,
        phone: record.phone ?? "",
        email: record.email ?? "",
        emergencyContactName: record.emergencyContactName ?? "",
        emergencyContactPhone: record.emergencyContactPhone ?? "",
        emergencyContactRelation: record.emergencyContactRelation ?? "",
        dietaryRestrictions: record.dietaryRestrictions ?? "",
        includePhoneOnCallSheet: record.includePhoneOnCallSheet,
        includeEmailOnCallSheet: record.includeEmailOnCallSheet,
      }}
    />
  );
}
