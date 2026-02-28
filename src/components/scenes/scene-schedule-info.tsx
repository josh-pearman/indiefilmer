import Link from "next/link";
import { localDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ShootDayRow = {
  id: string;
  date: Date;
  callTime: string | null;
  status: string;
  locationName: string | null;
  dayNumber?: number;
};

type SceneScheduleInfoProps = {
  shootDays: ShootDayRow[];
};

export function SceneScheduleInfo({ shootDays }: SceneScheduleInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <p className="text-sm text-muted-foreground">
          Shoot days this scene is assigned to (managed from the Schedule
          module).
        </p>
      </CardHeader>
      <CardContent>
        {shootDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This scene is not yet assigned to a shoot day.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium">Day</th>
                  <th className="pb-2 text-left font-medium">Date</th>
                  <th className="pb-2 text-left font-medium">Call time</th>
                  <th className="pb-2 text-left font-medium">Location</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shootDays.map((day) => (
                  <tr
                    key={day.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2">
                      {day.dayNumber ? (
                        <Link
                          href={`/production/schedule/${day.id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          Day {day.dayNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
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
                    <td className="py-2">{day.locationName ?? "—"}</td>
                    <td className="py-2">{day.status}</td>
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
