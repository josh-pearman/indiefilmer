import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SceneRow = {
  id: string;
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
  locationName: string | null;
};

type CastScenesProps = {
  scenes: SceneRow[];
};

export function CastScenes({ scenes }: CastScenesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scenes</CardTitle>
        <p className="text-sm text-muted-foreground">
          Scenes this cast member appears in (managed from the Scenes module).
        </p>
      </CardHeader>
      <CardContent>
        {scenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This cast member is not assigned to any scenes yet. Assign them from
            the Scenes module.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium">Scene</th>
                  <th className="pb-2 text-left font-medium">Title</th>
                  <th className="pb-2 text-left font-medium">INT/EXT</th>
                  <th className="pb-2 text-left font-medium">DAY/NIGHT</th>
                  <th className="pb-2 text-left font-medium">Location</th>
                </tr>
              </thead>
              <tbody>
                {scenes.map((scene) => (
                  <tr
                    key={scene.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2">
                      <Link
                        href={`/script/scenes/${scene.id}`}
                        className="text-primary hover:underline"
                      >
                        {scene.sceneNumber}
                      </Link>
                    </td>
                    <td className="py-2">{scene.title ?? "—"}</td>
                    <td className="py-2">{scene.intExt ?? "—"}</td>
                    <td className="py-2">{scene.dayNight ?? "—"}</td>
                    <td className="py-2">{scene.locationName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
