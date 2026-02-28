import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getTalentStats() {
  const projectId = await requireCurrentProjectId();

  const [cast, crew, contacts] = await Promise.all([
    prisma.castMember.findMany({
      where: { projectId, isDeleted: false },
      select: { actorName: true, status: true },
    }),
    prisma.crewMember.findMany({
      where: { projectId, isDeleted: false },
      select: { status: true },
    }),
    prisma.castMember.count({
      where: {
        projectId,
        isDeleted: false,
        OR: [
          { phone: { not: null } },
          { email: { not: null } },
        ],
      },
    }),
  ]);

  const rolesCast = cast.filter((c) => c.actorName && c.actorName.trim() !== "").length;
  const confirmed = cast.filter((c) => c.status === "Confirmed").length;
  const crewConfirmed = crew.filter((c) => c.status === "Confirmed").length;

  return {
    totalCast: cast.length,
    rolesCast,
    castConfirmed: confirmed,
    totalCrew: crew.length,
    crewConfirmed,
    contactCount: contacts,
  };
}

export default async function TalentPage() {
  const data = await getTalentStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Talent</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cast, crew, and contacts for your production.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Cast & Roles</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totalCast}</p>
            <p className="text-xs text-muted-foreground">
              {data.rolesCast} cast · {data.castConfirmed} confirmed
            </p>
            <Link href="/talent/cast" className="mt-2 inline-block text-xs text-primary hover:underline">
              View cast →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Crew</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.totalCrew}</p>
            <p className="text-xs text-muted-foreground">
              {data.crewConfirmed} confirmed
            </p>
            <Link href="/talent/crew" className="mt-2 inline-block text-xs text-primary hover:underline">
              View crew →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Contacts</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data.contactCount}</p>
            <p className="text-xs text-muted-foreground">with contact info</p>
            <Link href="/talent/contacts" className="mt-2 inline-block text-xs text-primary hover:underline">
              View contacts →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
