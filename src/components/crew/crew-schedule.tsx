"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { localDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toggleCrewDayAssignment } from "@/actions/schedule";

type ShootDayRow = {
  id: string;
  date: Date;
  callTime: string | null;
  locationName: string | null;
  status: string;
};

type CrewScheduleProps = {
  shootDays: ShootDayRow[];
  crewMemberId: string;
  assignedDayIds: string[];
};

export function CrewSchedule({ shootDays, crewMemberId, assignedDayIds }: CrewScheduleProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle(shootDayId: string) {
    startTransition(async () => {
      await toggleCrewDayAssignment(crewMemberId, shootDayId);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule</CardTitle>
        <p className="text-sm text-muted-foreground">
          Assign this crew member to specific shoot days.
        </p>
      </CardHeader>
      <CardContent>
        {shootDays.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No shoot days scheduled yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium w-10">Assigned</th>
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
                      <input
                        type="checkbox"
                        checked={assignedDayIds.includes(day.id)}
                        disabled={isPending}
                        onChange={() => handleToggle(day.id)}
                        className="h-4 w-4 rounded border-border"
                      />
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
