/**
 * Groups dietary restriction strings (e.g. "Vegan", "Gluten-free, nut allergy")
 * by normalized term, case-insensitive. Returns lines like "2 Vegan", "1 Gluten-free".
 */
export function formatDietarySummary(restrictions: string[]): string[] {
  const trimmed = restrictions
    .map((r) => r.trim())
    .filter(Boolean);
  if (trimmed.length === 0) return [];
  const parts: string[] = [];
  for (const r of trimmed) {
    parts.push(...r.split(",").map((p) => p.trim()).filter(Boolean));
  }
  const byKey = new Map<string, { count: number; label: string }>();
  for (const p of parts) {
    const key = p.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.count++;
    } else {
      byKey.set(key, { count: 1, label: p });
    }
  }
  return Array.from(byKey.values())
    .sort((a, b) => b.count - a.count)
    .map(({ count, label }) => (count > 1 ? `${count} ${label}` : label));
}
