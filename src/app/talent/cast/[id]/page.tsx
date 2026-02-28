import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getCurrentProjectId } from "@/lib/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CastForm } from "@/components/cast/cast-form";
import { CastScenes } from "@/components/cast/cast-scenes";
import { CastSchedule } from "@/components/cast/cast-schedule";
import { CastHistory } from "@/components/cast/cast-history";
import { CastDetailClient } from "@/components/cast/cast-detail-client";

async function getCastMember(id: string, projectId: string) {
  return prisma.castMember.findFirst({
    where: { id, projectId }
  });
}

async function getCastScenes(castMemberId: string, projectId: string) {
  const assignments = await prisma.sceneCast.findMany({
    where: { castMemberId },
    include: {
      scene: {
        include: { location: { select: { name: true } } }
      }
    }
  });
  return assignments
    .filter((a) => !a.scene.isDeleted && a.scene.projectId === projectId)
    .map((a) => ({
      id: a.scene.id,
      sceneNumber: a.scene.sceneNumber,
      title: a.scene.title,
      intExt: a.scene.intExt,
      dayNight: a.scene.dayNight,
      locationName: a.scene.location?.name ?? null
    }));
}

async function getCastShootDays(castMemberId: string, projectId: string) {
  const assignments = await prisma.sceneCast.findMany({
    where: { castMemberId },
    include: { scene: { select: { id: true, isDeleted: true } } }
  });
  const sceneIds = assignments
    .filter((a) => !a.scene.isDeleted)
    .map((a) => a.scene.id);
  if (sceneIds.length === 0) return [];

  const sds = await prisma.shootDayScene.findMany({
    where: { sceneId: { in: sceneIds }, shootDay: { projectId } },
    include: {
      shootDay: {
        include: { location: { select: { name: true } } }
      },
      scene: { select: { sceneNumber: true } }
    }
  });

  const byDay = new Map<
    string,
    { id: string; date: Date; callTime: string | null; locationName: string | null; status: string; sceneNumbers: string[] }
  >();
  for (const row of sds) {
    const day = row.shootDay;
    if (day.isDeleted) continue;
    const key = day.id;
    if (!byDay.has(key)) {
      byDay.set(key, {
        id: day.id,
        date: day.date,
        callTime: day.callTime,
        locationName: day.location?.name ?? null,
        status: day.status,
        sceneNumbers: []
      });
    }
    byDay.get(key)!.sceneNumbers.push(row.scene.sceneNumber);
  }
  return Array.from(byDay.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

async function getCastAuditLog(castMemberId: string, limit: number, projectId: string) {
  return prisma.auditLog.findMany({
    where: { projectId, entityType: "CastMember", entityId: castMemberId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export default async function CastDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  if (!projectId) notFound();
  const [castMember, scenes, shootDays, auditEntries, settings] =
    await Promise.all([
      getCastMember(id, projectId),
      getCastScenes(id, projectId),
      getCastShootDays(id, projectId),
      getCastAuditLog(id, 50, projectId),
      prisma.projectSettings.findUnique({ where: { projectId }, select: { currencySymbol: true } })
    ]);
  const currencySymbol = settings?.currencySymbol ?? "$";

  if (!castMember) notFound();

  const defaultFormValues = {
    name: castMember.name,
    roleName: castMember.roleName ?? "",
    actorName: castMember.actorName ?? "",
    castingLink: castMember.castingLink ?? "",
    status: castMember.status,
    phone: castMember.phone ?? "",
    email: castMember.email ?? "",
    includePhoneOnCallSheet: castMember.includePhoneOnCallSheet,
    includeEmailOnCallSheet: castMember.includeEmailOnCallSheet,
    emergencyContactName: castMember.emergencyContactName ?? "",
    emergencyContactPhone: castMember.emergencyContactPhone ?? "",
    emergencyContactRelation: castMember.emergencyContactRelation ?? "",
    dietaryRestrictions: castMember.dietaryRestrictions ?? "",
    notes: castMember.notes ?? "",
    rate: castMember.rate != null ? String(castMember.rate) : "",
    days: castMember.days != null ? String(castMember.days) : "",
    flatFee: castMember.flatFee != null ? String(castMember.flatFee) : "",
    plannedAmount: castMember.plannedAmount != null ? String(castMember.plannedAmount) : ""
  };

  const calculatedCost =
    castMember.flatFee != null && castMember.flatFee > 0
      ? castMember.flatFee
      : castMember.rate != null &&
          castMember.days != null &&
          castMember.rate > 0 &&
          castMember.days > 0
        ? castMember.rate * castMember.days
        : null;

  return (
    <div className="space-y-6">
      <Link
        href="/talent/cast"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Cast
      </Link>

      {castMember.isDeleted && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">This cast member has been deleted.</span>{" "}
          <span className="inline-block">
            <CastDetailClient
              castId={castMember.id}
              action="restore"
              label="Restore"
            />
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            className={cn(
              "text-2xl font-semibold tracking-tight",
              castMember.isDeleted && "line-through"
            )}
          >
            {castMember.name}
            {castMember.roleName ? ` — ${castMember.roleName}` : ""}
          </h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              castMember.status === "Confirmed" && "bg-green-500/15 text-green-700 dark:text-green-400",
              castMember.status === "Pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              castMember.status === "Backup" && "bg-blue-500/15 text-blue-700 dark:text-blue-400",
              castMember.status === "TBD" && "bg-muted text-muted-foreground"
            )}
          >
            {castMember.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {castMember.actorName?.trim() && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {castMember.actorName}
            </span>
          )}
          {castMember.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {castMember.phone}
            </span>
          )}
          {castMember.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {castMember.email}
            </span>
          )}
          <span>{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</span>
          <span>{shootDays.length} shoot day{shootDays.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core info</CardTitle>
        </CardHeader>
        <CardContent>
          <CastForm
            mode="edit"
            castId={castMember.id}
            defaultValues={defaultFormValues}
            submitLabel="Save"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Planned Budget</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {castMember.plannedAmount != null
                  ? `${currencySymbol}${castMember.plannedAmount.toLocaleString()}`
                  : "Not set"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated Cost</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {calculatedCost != null
                  ? `${currencySymbol}${calculatedCost.toLocaleString()}`
                  : "No estimate"}
              </p>
              <p className="text-xs text-muted-foreground">
                Uses flat fee if set; otherwise rate × days.
              </p>
            </div>
          </div>
          {castMember.plannedAmount != null && calculatedCost != null && (
            <div className="mt-3">
              {(() => {
                const variance = castMember.plannedAmount - calculatedCost;
                const isUnder = variance >= 0;
                return (
                  <p className={`text-sm font-medium ${isUnder ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {isUnder
                      ? `${currencySymbol}${variance.toLocaleString()} under budget`
                      : `${currencySymbol}${Math.abs(variance).toLocaleString()} over budget`}
                  </p>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      <CastScenes scenes={scenes} />
      <CastSchedule shootDays={shootDays} />

      <CastHistory
        entries={auditEntries.map((e) => ({
          id: e.id,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          before: e.before,
          after: e.after,
          changeNote: e.changeNote,
          performedBy: e.performedBy,
          createdAt: e.createdAt
        }))}
        initialVisible={20}
      />

      {!castMember.isDeleted && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Deleting this cast member will remove them from all scene assignments.
            </p>
            <CastDetailClient
              castId={castMember.id}
              action="delete"
              label="Delete cast member"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
