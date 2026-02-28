import Link from "next/link";
import type { TopCostDriver } from "@/lib/budget-rollup";

type BudgetTopDriversProps = {
  drivers: TopCostDriver[];
  currencySymbol?: string;
};

function driverHref(d: TopCostDriver): string | null {
  switch (d.type) {
    case "Location":
      return `/production/locations/${d.sourceId}`;
    case "CastMember":
      return `/talent/cast/${d.sourceId}`;
    case "CrewMember":
      return `/talent/crew/${d.sourceId}`;
    case "ShootDay":
      return `/production/schedule/${d.sourceId}`;
    case "GearModel":
    case "CraftServices":
      return null;
    default:
      return null;
  }
}

export function BudgetTopDrivers({ drivers, currencySymbol = "$" }: BudgetTopDriversProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-semibold">Top Cost Drivers</h3>
      {drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No cost data yet. Add locations, cast, crew, gear, or craft services to
          see estimated costs.
        </p>
      ) : (
        <ol className="list-inside list-decimal space-y-1 text-sm">
          {drivers.map((d, i) => {
            const href = driverHref(d);
            return (
              <li key={`${d.type}-${d.sourceId}-${i}`}>
                {href ? (
                  <Link
                    href={href}
                    className="text-primary hover:underline"
                  >
                    {d.name}
                  </Link>
                ) : (
                  <span>{d.name}</span>
                )}{" "}
                — {currencySymbol}{d.estimatedCost.toLocaleString()} estimated
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
