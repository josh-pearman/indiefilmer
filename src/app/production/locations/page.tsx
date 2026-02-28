import { prisma } from "@/lib/db";
import { getCurrentProjectId } from "@/lib/project";
import { LocationList } from "@/components/locations/location-list";

async function getLocations(projectId: string | null) {
  if (!projectId) return [];
  const locationsRaw = await prisma.location.findMany({
    where: { projectId },
    include: {
      _count: {
        select: { scenes: { where: { isDeleted: false } } }
      }
    }
  });
  return [...locationsRaw].sort(
    (a, b) => (b._count?.scenes ?? 0) - (a._count?.scenes ?? 0)
  );
}

export default async function LocationsPage() {
  const projectId = await getCurrentProjectId();
  const [locations, settings] = await Promise.all([
    getLocations(projectId),
    projectId
      ? prisma.projectSettings.findUnique({ where: { projectId }, select: { currencySymbol: true } })
      : Promise.resolve(null)
  ]);
  const autocompleteEnabled = !!process.env.GOOGLE_MAPS_API_KEY;
  const currencySymbol = settings?.currencySymbol ?? "$";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Location candidates, status pipeline, costs, and linked scenes.
        </p>
      </div>
      <LocationList locations={locations} autocompleteEnabled={autocompleteEnabled} currencySymbol={currencySymbol} />
    </div>
  );
}
