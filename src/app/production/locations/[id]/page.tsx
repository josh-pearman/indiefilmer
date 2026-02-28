import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Film, Calendar } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireCurrentProjectId } from "@/lib/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updateLocationName,
  updateLocationPlannedBudget,
  ensureLocationHasVenue,
  ensureLocationFilesAssignedToVenue,
} from "@/actions/locations";
import { LocationStatusPipeline } from "@/components/locations/location-status-pipeline";
import { LocationCostSummary } from "@/components/locations/location-cost-summary";
import { LocationVenuesEditor } from "@/components/locations/location-venues-editor";
import { LocationLinkedScenes } from "@/components/locations/location-linked-scenes";
import { LocationShootDays } from "@/components/locations/location-shoot-days";
import { LocationHistory } from "@/components/locations/location-history";
import { LocationDetailClient } from "@/components/locations/location-detail-client";
import { cn } from "@/lib/utils";

async function getLocation(id: string, projectId: string) {
  return prisma.location.findFirst({
    where: { id, projectId },
    include: {
      files: {
        select: { id: true, fileName: true, filePath: true, venueId: true },
        orderBy: { createdAt: "desc" }
      },
      venues: {
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

async function getLocationScenes(locationId: string, projectId: string) {
  return prisma.scene.findMany({
    where: { projectId, locationId, isDeleted: false },
    select: {
      id: true,
      sceneNumber: true,
      title: true,
      intExt: true,
      dayNight: true,
      pageCount: true
    },
    orderBy: { sceneNumber: "asc" }
  });
}

async function getLocationShootDays(locationId: string, projectId: string) {
  const days = await prisma.shootDay.findMany({
    where: { projectId, locationId, isDeleted: false },
    include: { _count: { select: { scenes: true } } },
    orderBy: { date: "asc" }
  });
  return days.map((d) => ({
    id: d.id,
    date: d.date,
    callTime: d.callTime,
    status: d.status,
    sceneCount: d._count.scenes
  }));
}

async function getLocationAuditLog(locationId: string, limit: number, projectId: string) {
  return prisma.auditLog.findMany({
    where: { projectId, entityType: "Location", entityId: locationId },
    orderBy: { createdAt: "desc" },
    take: limit
  });
}

export default async function LocationDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = await requireCurrentProjectId();
  await ensureLocationHasVenue(id);
  await ensureLocationFilesAssignedToVenue(id);
  const [location, scenes, shootDays, auditEntries, settings] = await Promise.all([
    getLocation(id, projectId),
    getLocationScenes(id, projectId),
    getLocationShootDays(id, projectId),
    getLocationAuditLog(id, 50, projectId),
    prisma.projectSettings.findUnique({ where: { projectId }, select: { currencySymbol: true } })
  ]);
  const currencySymbol = settings?.currencySymbol ?? "$";

  if (!location) notFound();

  async function updateLocationNameAction(formData: FormData) {
    "use server";
    await updateLocationName(id, formData);
  }

  async function updatePlannedBudgetAction(formData: FormData) {
    "use server";
    await updateLocationPlannedBudget(id, formData);
  }

  const autocompleteEnabled = !!process.env.GOOGLE_MAPS_API_KEY;

  return (
    <div
      className={cn(
        "space-y-6",
        location.status === "Booked" && "rounded-lg bg-green-500/5",
        location.status === "Rejected" && "rounded-lg bg-destructive/5"
      )}
    >
      <Link
        href="/production/locations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Locations
      </Link>

      {location.isDeleted && (
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="font-medium">This location has been deleted.</span>{" "}
          <span className="inline-block">
            <LocationDetailClient
              locationId={location.id}
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
              location.status === "Rejected" && "line-through"
            )}
          >
            {location.name}
          </h1>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              location.status === "Booked" && "bg-green-500/15 text-green-700 dark:text-green-400",
              location.status === "Visited" && "bg-blue-500/15 text-blue-700 dark:text-blue-400",
              location.status === "Contacted" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              location.status === "On Hold" && "bg-orange-500/15 text-orange-700 dark:text-orange-400",
              location.status === "Rejected" && "bg-destructive/15 text-destructive",
              location.status === "Shortlist" && "bg-muted text-muted-foreground"
            )}
          >
            {location.status}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {location.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {location.address}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Film className="h-3.5 w-3.5" />
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {shootDays.length} shoot day{shootDays.length !== 1 ? "s" : ""}
          </span>
          <span>{location.venues.length} venue{location.venues.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Location Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateLocationNameAction} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <label htmlFor="location-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="location-name"
                name="name"
                defaultValue={location.name}
                placeholder="Location name"
              />
            </div>
            <Button type="submit">Save Name</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Venue(s)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Add multiple venue options for this location. The selected tab drives budget, scenes, and schedule.
          </p>
        </CardHeader>
        <CardContent>
          <LocationVenuesEditor
            locationId={location.id}
            venues={location.venues}
            selectedVenueId={location.selectedVenueId}
            files={location.files}
            autocompleteEnabled={autocompleteEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status pipeline</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click a status to update. Rejected can be set from any state.
          </p>
        </CardHeader>
        <CardContent>
          <LocationStatusPipeline
            locationId={location.id}
            currentStatus={location.status}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost & budget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <form action={updatePlannedBudgetAction} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[16rem] flex-1 space-y-2">
              <label htmlFor="planned-budget" className="text-sm font-medium">
                Planned Budget ({currencySymbol})
              </label>
              <p className="text-xs text-muted-foreground">
                Your target budget allocation for this location.
              </p>
              <Input
                id="planned-budget"
                name="plannedAmount"
                type="number"
                min={0}
                step={0.01}
                defaultValue={location.plannedAmount != null ? String(location.plannedAmount) : ""}
                placeholder="Not set"
              />
            </div>
            <Button type="submit">Save Budget</Button>
          </form>

          <hr className="border-border" />

          <LocationCostSummary
            estimatedCostPerDay={location.estimatedCostPerDay}
            numberOfDays={location.numberOfDays}
            fees={location.fees}
            plannedAmount={location.plannedAmount}
            currencySymbol={currencySymbol}
          />
        </CardContent>
      </Card>

      <LocationLinkedScenes
        scenes={scenes.map((s) => ({
          id: s.id,
          sceneNumber: s.sceneNumber,
          title: s.title,
          intExt: s.intExt,
          dayNight: s.dayNight,
          pageCount: s.pageCount
        }))}
      />

      <LocationShootDays shootDays={shootDays} />

      <LocationHistory
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

      {!location.isDeleted && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Deleting this location will unlink it from all scenes and shoot days.
            </p>
            <LocationDetailClient
              locationId={location.id}
              action="delete"
              label="Delete location"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
