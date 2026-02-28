export default function ScheduleLoading() {
  return (
    <div className="space-y-6 p-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-9 w-64 animate-pulse rounded bg-muted" />
        <div className="h-9 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
