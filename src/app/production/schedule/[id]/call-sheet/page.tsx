import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrCreateCallSheet } from "@/actions/call-sheet";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { localDate } from "@/lib/utils";
import { getShootDayNumberMap } from "@/lib/schedule";
import { CallSheetEditor } from "@/components/schedule/call-sheet-editor";
import { isEmailEnabled } from "@/lib/email";

async function getShootDayWithRelations(id: string, projectId: string) {
  const shootDay = await prisma.shootDay.findFirst({
    where: { id, projectId, isDeleted: false },
    include: {
      location: true,
      scenes: {
        orderBy: { sortOrder: "asc" },
        include: {
          scene: {
            include: {
              tags: true,
              castAssignments: { include: { castMember: true } }
            }
          }
        }
      }
    }
  });
  return shootDay;
}

async function getCrew(projectId: string) {
  return prisma.crewMember.findMany({
    where: { projectId, isDeleted: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      position: true,
      phone: true,
      email: true,
      includePhoneOnCallSheet: true,
      includeEmailOnCallSheet: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true
    }
  });
}

export default async function CallSheetPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await requireCurrentProjectId();
  const [shootDay, crew, dayNumberMap, settings] = await Promise.all([
    getShootDayWithRelations(id, projectId),
    getCrew(projectId),
    getShootDayNumberMap(projectId),
    prisma.projectSettings.findUnique({ where: { projectId }, select: { projectName: true } })
  ]);

  if (!shootDay) notFound();

  let callSheet = await getOrCreateCallSheet(id);
  if (!callSheet) notFound();

  // Backfill CallSheetCrew for existing call sheets that have no crew records
  const crewCount = await prisma.callSheetCrew.count({
    where: { callSheetId: callSheet.id }
  });
  if (crewCount === 0 && crew.length > 0) {
    await prisma.callSheetCrew.createMany({
      data: crew.map((c) => ({
        callSheetId: callSheet!.id,
        crewId: c.id
      }))
    });
  }

  const callSheetWithCrew = await prisma.callSheet.findUnique({
    where: { id: callSheet.id },
    include: {
      crew: { include: { crew: true } }
    }
  });
  const callSheetData = callSheetWithCrew ?? callSheet;
  // Sort crew by name for display
  if (callSheetData && "crew" in callSheetData && Array.isArray(callSheetData.crew)) {
    callSheetData.crew.sort(
      (a, b) => (a.crew.name ?? "").localeCompare(b.crew.name ?? "")
    );
  }

  const latestEmailLog = await prisma.auditLog.findFirst({
    where: {
      projectId,
      entityType: "CallSheetEmail",
      entityId: callSheetData.id
    },
    orderBy: { createdAt: "desc" }
  });

  const dayScenes = shootDay.scenes
    .filter((sds) => !sds.scene.isDeleted)
    .map((sds) => {
      const s = sds.scene;
      return {
        id: s.id,
        sceneNumber: s.sceneNumber,
        title: s.title,
        intExt: s.intExt,
        dayNight: s.dayNight,
        pageCount: s.pageCount,
        synopsis: s.synopsis,
        tags: s.tags.map((t) => t.tag),
        cast: s.castAssignments.map((a) => ({
          name: a.castMember.name,
          roleName: a.castMember.roleName,
          actorName: a.castMember.actorName
        }))
      };
    });

  const castIdsSeen = new Set<string>();
  const emergencyContacts: Array<{
    name: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
  }> = [];
  const castEmails: Array<{ name: string; email: string }> = [];
  for (const sds of shootDay.scenes) {
    if (sds.scene.isDeleted) continue;
    for (const a of sds.scene.castAssignments) {
      const c = a.castMember;
      if (castIdsSeen.has(c.id)) continue;
      castIdsSeen.add(c.id);
      castEmails.push({ name: c.name, email: c.email ?? "" });
      if (
        c.emergencyContactName ||
        c.emergencyContactPhone ||
        c.emergencyContactRelation
      ) {
        emergencyContacts.push({
          name: c.name,
          emergencyContactName: c.emergencyContactName ?? "",
          emergencyContactPhone: c.emergencyContactPhone ?? "",
          emergencyContactRelation: c.emergencyContactRelation ?? ""
        });
      }
    }
  }
  for (const c of crew) {
    if (
      c.emergencyContactName ||
      c.emergencyContactPhone ||
      c.emergencyContactRelation
    ) {
      emergencyContacts.push({
        name: c.name,
        emergencyContactName: c.emergencyContactName ?? "",
        emergencyContactPhone: c.emergencyContactPhone ?? "",
        emergencyContactRelation: c.emergencyContactRelation ?? ""
      });
    }
  }

  const payload = {
    shootDayDateFormatted: localDate(shootDay.date).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    }),
    projectName: settings?.projectName ?? "Untitled Project",
    dayNumber: dayNumberMap.get(id) ?? 0,
    shootDay: {
      id: shootDay.id,
      date: shootDay.date.toISOString().slice(0, 10),
      callTime: shootDay.callTime,
      status: shootDay.status,
      notes: shootDay.notes,
      meals: shootDay.meals,
      transport: shootDay.transport,
      misc: shootDay.misc
    },
    location: shootDay.location
      ? {
          id: shootDay.location.id,
          name: shootDay.location.name,
          address: shootDay.location.address
        }
      : null,
    scenes: dayScenes,
    crew: crew.map((c) => ({
      id: c.id,
      name: c.name,
      position: c.position,
      phone: c.phone ?? "",
      email: c.email ?? "",
      includePhoneOnCallSheet: c.includePhoneOnCallSheet,
      includeEmailOnCallSheet: c.includeEmailOnCallSheet
    })),
    emergencyContacts,
    castEmails,
    callSheet: {
      id: callSheetData.id,
      generalCallTime: callSheetData.generalCallTime,
      announcements: callSheetData.announcements,
      weatherSummary: callSheetData.weatherSummary,
      sunrise: callSheetData.sunrise,
      sunset: callSheetData.sunset,
      nearestHospital: callSheetData.nearestHospital,
      emergencyContact: callSheetData.emergencyContact,
      personalCallTimes: callSheetData.personalCallTimes,
      mapImageUrl: callSheetData.mapImageUrl
    },
    lastEmailSentAt: latestEmailLog?.createdAt.toISOString() ?? null,
    callSheetCrew:
      "crew" in callSheetData && Array.isArray(callSheetData.crew)
        ? callSheetData.crew.map((cs) => ({
            id: cs.id,
            crewId: cs.crewId,
            callTime: cs.callTime ?? "",
            name: cs.crew.name,
            position: cs.crew.position,
            phone: cs.crew.phone ?? "",
            email: cs.crew.email ?? "",
            includePhoneOnCallSheet: cs.crew.includePhoneOnCallSheet,
            includeEmailOnCallSheet: cs.crew.includeEmailOnCallSheet
          }))
        : []
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <Link href={`/production/schedule/${id}`} className="text-primary hover:underline">
          ← Back to Shoot Day
        </Link>
      </div>
      <CallSheetEditor
        shootDayId={id}
        initialData={payload}
        emailEnabled={isEmailEnabled()}
      />
    </div>
  );
}
