import Link from "next/link";
import { localDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ShootDayRow = {
  id: string;
  date: Date;
  callTime: string | null;
  status: string;
  sceneCount: number;
};

type LocationShootDaysProps = {
  shootDays: ShootDayRow[];
};

export function LocationShootDays({ shootDays }: LocationShootDaysProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Shoot days at this location</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shoot days that reference this location.
        </p>
      </CardHeader>
      <CardContent>
        {shootDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shoot days scheduled at this location yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-left font-medium">Call time</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Scenes</th>
                </tr>
              </thead>
              <tbody>
                {shootDays.map((day) => (
                  <tr
                    key={day.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2">
                      <Link
                        href={`/production/schedule/${day.id}`}
                        className="text-primary hover:underline"
                      >
                        {localDate(day.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </Link>
                    </td>
                    <td className="py-2">{day.callTime ?? "—"}</td>
                    <td className="py-2">{day.status}</td>
                    <td className="py-2 text-right">{day.sceneCount}</td>
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
