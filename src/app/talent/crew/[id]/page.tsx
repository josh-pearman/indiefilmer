import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { getCurrentProjectId } from "@/lib/project";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrewForm } from "@/components/crew/crew-form";
import { CrewSchedule } from "@/components/crew/crew-schedule";
import { CrewHistory } from "@/components/crew/crew-history";
import { CrewDetailClient } from "@/components/crew/crew-detail-client";

async function getCrewMember(id: string, projectId: string) {
  return prisma.crewMember.findFirst({
    where: { id, projectId }
  });
}

async function getAllShootDays(projectId: string) {
  return prisma.shootDay.findMany({
    where: { projectId, isDeleted: false },
    include: { location: { select: { name: true } } },
    orderBy: { date: "asc" }
  });
}

async function getCrewAuditLog(crewMemberId: string, limit: number, projectId: string) {
  return prisma.auditLog.findMany({
    where: { projectId, entityType: "CrewMember", entityId: crewMemberId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export default async function CrewDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await getCurrentProjectId();
  if (!projectId) notFound();
  const [crewMember, shootDays, auditEntries, settings, crewAssignments] = await Promise.all([
    getCrewMember(id, projectId),
    getAllShootDays(projectId),
    getCrewAuditLog(id, 50, projectId),
    prisma.projectSettings.findUnique({ where: { projectId }, select: { currencySymbol: true } }),
    prisma.shootDayCrew.findMany({
      where: { crewMemberId: id },
      select: { shootDayId: true }
    })
  ]);
  const currencySymbol = settings?.currencySymbol ?? "$";

  if (!crewMember) notFound();

  const defaultFormValues = {
    name: crewMember.name,
    position: crewMember.position,
    phone: crewMember.phone ?? "",
    email: crewMember.email ?? "",
    includePhoneOnCallSheet: crewMember.includePhoneOnCallSheet,
    includeEmailOnCallSheet: crewMember.includeEmailOnCallSheet,
    emergencyContactName: crewMember.emergencyContactName ?? "",
    emergencyContactPhone: crewMember.emergencyContactPhone ?? "",
    emergencyContactRelation: crewMember.emergencyContactRelation ?? "",
    dietaryRestrictions: crewMember.dietaryRestrictions ?? "",
    status: crewMember.status,
    notes: crewMember.notes ?? "",
    rate: crewMember.rate != null ? String(crewMember.rate) : "",
    days: crewMember.days != null ? String(crewMember.days) : "",
    flatFee: crewMember.flatFee != null ? String(crewMember.flatFee) : "",
    plannedAmount: crewMember.plannedAmount != null ? String(crewMember.plannedAmount) : ""
  };

  const calculatedCost =
    crewMember.flatFee != null && crewMember.flatFee > 0
      ? crewMember.flatFee
      : crewMember.rate != null &&
          crewMember.days != null &&
          crewMember.rate > 0 &&
          crewMember.days > 0
        ? crewMember.rate * crewMember.days
        : null;

  const scheduleRows = shootDays.map((d) => ({
    id: d.id,
    date: d.date,
    callTime: d.callTime,
    locationName: d.location?.name ?? null,
    status: d.status
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/talent/crew"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Crew
      </Link>

      {crewMember.isDeleted && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">This crew member has been deleted.</span>{" "}
          <span className="inline-block">
            <CrewDetailClient
              crewId={crewMember.id}
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
              crewMember.isDeleted && "line-through"
            )}
          >
            {crewMember.name || "Unfilled"} — {crewMember.position}
          </h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              crewMember.status === "Confirmed" && "bg-green-500/15 text-green-700 dark:text-green-400",
              crewMember.status === "Pending" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              crewMember.status === "TBD" && "bg-muted text-muted-foreground"
            )}
          >
            {crewMember.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {crewMember.phone && (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {crewMember.phone}
            </span>
          )}
          {crewMember.email && (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {crewMember.email}
            </span>
          )}
          <span>{crewAssignments.length} shoot day{crewAssignments.length !== 1 ? "s" : ""} assigned</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Core info</CardTitle>
        </CardHeader>
        <CardContent>
          <CrewForm
            mode="edit"
            crewId={crewMember.id}
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
                {crewMember.plannedAmount != null
                  ? `${currencySymbol}${crewMember.plannedAmount.toLocaleString()}`
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
          {crewMember.plannedAmount != null && calculatedCost != null && (
            <div className="mt-3">
              {(() => {
                const variance = crewMember.plannedAmount - calculatedCost;
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

      <CrewSchedule
        shootDays={scheduleRows}
        crewMemberId={crewMember.id}
        assignedDayIds={crewAssignments.map((a) => a.shootDayId)}
      />

      <CrewHistory
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

      {!crewMember.isDeleted && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Deleting this crew member will remove them from all shoot day assignments.
            </p>
            <CrewDetailClient
              crewId={crewMember.id}
              action="delete"
              label="Delete crew member"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
