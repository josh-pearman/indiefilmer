import { prisma } from "@/lib/db";

const CREW_POSITION_ORDER = [
  "Director",
  "Producer",
  "Executive Producer",
  "Writer",
  "Director of Photography",
  "DP",
  "Camera Operator",
  "1st AD",
  "2nd AD",
  "Production Designer",
  "Art Director",
  "Wardrobe",
  "Makeup",
  "Hair",
  "Sound Mixer",
  "Boom Operator",
  "Gaffer",
  "Key Grip",
  "Grip",
  "Electric",
  "Script Supervisor",
  "Editor",
  "Colorist",
  "VFX Artist",
  "Composer",
  "Music Supervisor",
  "Stills Photographer",
  "PA",
  "Intern"
];

function castSortTier(roleName: string | null): number {
  if (!roleName) return 3;
  const r = roleName.toLowerCase();
  if (r.includes("lead")) return 0;
  if (r.includes("supporting")) return 1;
  if (r.includes("minor")) return 2;
  return 3;
}

function crewPositionRank(position: string): number {
  const normalized = position.trim().toLowerCase();
  const idx = CREW_POSITION_ORDER.findIndex(
    (p) => p.toLowerCase() === normalized
  );
  return idx >= 0 ? idx : CREW_POSITION_ORDER.length;
}

export async function generateCreditsText(): Promise<string> {
  const [cast, crew] = await Promise.all([
    prisma.castMember.findMany({
      where: { isDeleted: false },
      orderBy: { name: "asc" }
    }),
    prisma.crewMember.findMany({
      where: { isDeleted: false },
      orderBy: { name: "asc" }
    })
  ]);

  const castSorted = [...cast].sort((a, b) => {
    const tierA = castSortTier(a.roleName);
    const tierB = castSortTier(b.roleName);
    if (tierA !== tierB) return tierA - tierB;
    return a.name.localeCompare(b.name);
  });

  const crewByPosition = new Map<string, typeof crew>();
  for (const c of crew) {
    const key = c.position.trim();
    if (!crewByPosition.has(key)) crewByPosition.set(key, []);
    crewByPosition.get(key)!.push(c);
  }
  const positions = [...crewByPosition.keys()].sort((a, b) => {
    const rankA = crewPositionRank(a);
    const rankB = crewPositionRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b);
  });

  const lines: string[] = [];
  lines.push("CAST");
  lines.push("");
  for (const c of castSorted) {
    const actorDisplay = c.actorName?.trim() ? c.actorName.trim() : "(TBD)";
    lines.push(`${actorDisplay} ... ${c.name}`);
  }
  lines.push("");
  lines.push("CREW");
  lines.push("");
  for (const pos of positions) {
    const members = crewByPosition.get(pos)!;
    const title =
      members.length > 1 ? pluralizePosition(pos) : pos;
    lines.push(title);
    for (const m of members.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(m.name);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function pluralizePosition(position: string): string {
  const trimmed = position.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "pa") return "Production Assistants";
  if (lower === "1st ad") return "1st ADs";
  if (lower === "2nd ad") return "2nd ADs";
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    const w = words[0];
    if (w.endsWith("s") || w.endsWith("x") || w.endsWith("ch") || w.endsWith("sh"))
      return w + "es";
    return w + "s";
  }
  return trimmed;
}
