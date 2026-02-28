import { prisma } from "@/lib/db";
import { calculateBudgetRollup } from "@/lib/budget-rollup";
import { localDate } from "@/lib/utils";

const LIST_CAP = 30;

export type ProjectSummary = {
  projectName: string;
  totalBudget: number;
  currencySymbol: string;
  remainingBudget: number;
  totalScenes: number;
  scenesScheduled: number;
  totalCast: number;
  rolesCast: number;
  totalLocations: number;
  totalCrew: number;
  totalShootDays: number;
  totalTasks: number;
};

export type PageContext = {
  pathname: string;
  summary: string;
};

export async function getProjectSummary(projectId: string): Promise<ProjectSummary> {
  const [
    settings,
    rollup,
    sceneStats,
    castStats,
    locationCount,
    crewCount,
    shootDayCount,
    taskCount
  ] = await Promise.all([
    prisma.projectSettings.findUnique({ where: { projectId } }),
    calculateBudgetRollup(projectId),
    prisma.scene.findMany({
      where: { projectId, isDeleted: false },
      select: {
        id: true,
        shootDayScenes: {
          where: { shootDay: { isDeleted: false } },
          select: { id: true }
        }
      }
    }),
    prisma.castMember.findMany({
      where: { projectId, isDeleted: false },
      select: { actorName: true }
    }),
    prisma.location.count({ where: { projectId, isDeleted: false } }),
    prisma.crewMember.count({ where: { projectId, isDeleted: false } }),
    prisma.shootDay.count({ where: { projectId, isDeleted: false } }),
    prisma.task.count({ where: { projectId, isDeleted: false } })
  ]);

  const totalScenes = sceneStats.length;
  const scenesScheduled = sceneStats.filter(
    (s: { shootDayScenes: unknown[] }) => s.shootDayScenes.length > 0
  ).length;
  const totalCast = castStats.length;
  const rolesCast = castStats.filter(
    (c: { actorName: string | null }) => c.actorName && c.actorName.trim() !== ""
  ).length;

  return {
    projectName: settings?.projectName ?? "Untitled Project",
    totalBudget: rollup.totalBudget,
    currencySymbol: rollup.currencySymbol,
    remainingBudget: rollup.summary.remaining,
    totalScenes,
    scenesScheduled,
    totalCast,
    rolesCast,
    totalLocations: locationCount,
    totalCrew: crewCount,
    totalShootDays: shootDayCount,
    totalTasks: taskCount
  };
}

export async function getPageContext(pathname: string, projectId: string): Promise<PageContext> {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const summary = await getContextForPath(normalized, projectId);
  return { pathname: normalized, summary };
}

async function getContextForPath(pathname: string, projectId: string): Promise<string> {
  // Dashboard
  if (pathname === "/") {
    const summary = await getProjectSummary(projectId);
    return [
      `Dashboard. Project: ${summary.projectName}.`,
      `Budget: ${summary.currencySymbol}${summary.totalBudget.toLocaleString()} total, ${summary.currencySymbol}${summary.remainingBudget.toLocaleString()} remaining.`,
      `Scenes: ${summary.scenesScheduled}/${summary.totalScenes} scheduled. Cast: ${summary.rolesCast}/${summary.totalCast} cast. Locations: ${summary.totalLocations}. Crew: ${summary.totalCrew}. Shoot days: ${summary.totalShootDays}. Tasks: ${summary.totalTasks}.`
    ].join(" ");
  }

  // Cast list
  if (pathname === "/talent/cast") {
    const list = await prisma.castMember.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true, roleName: true, actorName: true, status: true },
      orderBy: { name: "asc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (c) =>
        `- ${c.name}${c.roleName ? ` (${c.roleName})` : ""} — actor: ${c.actorName ?? "TBD"}, status: ${c.status} — [detail](/talent/cast/${c.id})`
    );
    return `Cast & Roles (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  // Cast detail
  const castIdMatch = pathname.match(/^\/talent\/cast\/([a-z0-9]+)$/i);
  if (castIdMatch) {
    const id = castIdMatch[1];
    const cast = await prisma.castMember.findFirst({
      where: { id, projectId },
      include: {
        sceneAssignments: {
          include: {
            scene: {
              select: { id: true, sceneNumber: true, title: true, isDeleted: true }
            }
          }
        }
      }
    });
    if (!cast) return `Cast member not found for id ${id}.`;
    const scenes = cast.sceneAssignments
      .filter((a) => !a.scene.isDeleted)
      .map((a) => `[Scene ${a.scene.sceneNumber}${a.scene.title ? ` ${a.scene.title}` : ""}](/script/scenes/${a.scene.id})`);
    return [
      `Cast: ${cast.name}${cast.roleName ? ` — ${cast.roleName}` : ""}. Actor: ${cast.actorName ?? "TBD"}. Status: ${cast.status}.`,
      scenes.length ? `Assigned scenes: ${scenes.join(", ")}.` : "No scene assignments."
    ].join(" ");
  }

  // Crew list
  if (pathname === "/talent/crew") {
    const list = await prisma.crewMember.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true, position: true, status: true },
      orderBy: { name: "asc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (c) => `- ${c.name} — ${c.position}, status: ${c.status} — [detail](/talent/crew/${c.id})`
    );
    return `Crew (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  // Crew detail
  const crewIdMatch = pathname.match(/^\/talent\/crew\/([a-z0-9]+)$/i);
  if (crewIdMatch) {
    const id = crewIdMatch[1];
    const crew = await prisma.crewMember.findFirst({ where: { id, projectId } });
    if (!crew) return `Crew member not found for id ${id}.`;
    return `Crew: ${crew.name} — ${crew.position}. Status: ${crew.status}.`;
  }

  // Scenes list
  if (pathname === "/script/scenes") {
    const list = await prisma.scene.findMany({
      where: { projectId, isDeleted: false },
      select: {
        id: true,
        sceneNumber: true,
        title: true,
        locationId: true,
        location: { select: { name: true } }
      },
      orderBy: { sceneNumber: "asc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (s) =>
        `- Scene ${s.sceneNumber}${s.title ? ` ${s.title}` : ""} — location: ${s.location?.name ?? "TBD"} — [detail](/script/scenes/${s.id})`
    );
    return `Scenes (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  // Scene detail
  const sceneIdMatch = pathname.match(/^\/script\/scenes\/([a-z0-9]+)$/i);
  if (sceneIdMatch) {
    const id = sceneIdMatch[1];
    const scene = await prisma.scene.findFirst({
      where: { id, projectId },
      include: {
        location: { select: { id: true, name: true } },
        castAssignments: {
          include: { castMember: { select: { id: true, name: true, roleName: true } } }
        },
        shootDayScenes: {
          include: {
            shootDay: { select: { id: true, date: true, status: true } }
          }
        }
      }
    });
    if (!scene) return `Scene not found for id ${id}.`;
    const loc = scene.location
      ? `[${scene.location.name}](/production/locations/${scene.location.id})`
      : "TBD";
    const cast = scene.castAssignments
      .map((a) => `[${a.castMember.name}](/talent/cast/${a.castMember.id})`)
      .join(", ");
    const days = scene.shootDayScenes
      .map((sds) => `[${localDate(sds.shootDay.date).toLocaleDateString()}](/production/schedule/${sds.shootDay.id})`)
      .join(", ");
    return [
      `Scene ${scene.sceneNumber}${scene.title ? ` ${scene.title}` : ""}. INT/EXT: ${scene.intExt ?? "—"}, Day/Night: ${scene.dayNight ?? "—"}.`,
      `Location: ${loc}.`,
      cast ? `Cast: ${cast}.` : "",
      days ? `Scheduled: ${days}.` : "Not scheduled."
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Locations list
  if (pathname === "/production/locations") {
    const list = await prisma.location.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, name: true, address: true, status: true },
      orderBy: { name: "asc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (l) =>
        `- ${l.name} — ${l.address ?? "no address"}, status: ${l.status} — [detail](/production/locations/${l.id})`
    );
    return `Locations (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  // Location detail
  const locIdMatch = pathname.match(/^\/production\/locations\/([a-z0-9]+)$/i);
  if (locIdMatch) {
    const id = locIdMatch[1];
    const loc = await prisma.location.findFirst({
      where: { id, projectId },
      include: {
        scenes: { where: { isDeleted: false }, select: { id: true, sceneNumber: true, title: true } }
      }
    });
    if (!loc) return `Location not found for id ${id}.`;
    const sceneLinks = loc.scenes.map(
      (s) => `[Scene ${s.sceneNumber}${s.title ? ` ${s.title}` : ""}](/script/scenes/${s.id})`
    );
    return [
      `Location: ${loc.name}. Address: ${loc.address ?? "—"}. Status: ${loc.status}.`,
      sceneLinks.length ? `Scenes at this location: ${sceneLinks.join(", ")}.` : "No scenes linked."
    ].join(" ");
  }

  // Schedule list
  if (pathname === "/production/schedule") {
    const list = await prisma.shootDay.findMany({
      where: { projectId, isDeleted: false },
      select: {
        id: true,
        date: true,
        callTime: true,
        status: true,
        location: { select: { name: true } }
      },
      orderBy: { date: "asc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (d) =>
        `- ${localDate(d.date).toLocaleDateString()} — ${d.location?.name ?? "TBD"}, ${d.status} — [detail](/production/schedule/${d.id})`
    );
    return `Schedule / Shoot days (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  // Schedule day detail (including /schedule/[id]/call-sheet)
  const scheduleIdMatch = pathname.match(/^\/production\/schedule\/([a-z0-9]+)(?:\/call-sheet)?$/i);
  if (scheduleIdMatch) {
    const id = scheduleIdMatch[1];
    const day = await prisma.shootDay.findFirst({
      where: { id, projectId },
      include: {
        location: { select: { id: true, name: true } },
        scenes: { include: { scene: { select: { id: true, sceneNumber: true, title: true } } } },
        crewMembers: { include: { crewMember: { select: { id: true, name: true, position: true } } } }
      }
    });
    if (!day) return `Shoot day not found for id ${id}.`;
    const loc = day.location
      ? `[${day.location.name}](/production/locations/${day.location.id})`
      : "TBD";
    const sceneLinks = day.scenes
      .map((sds) => `[Scene ${sds.scene.sceneNumber}](/script/scenes/${sds.scene.id})`)
      .join(", ");
    const crewLinks = day.crewMembers
      .map((sc) => `[${sc.crewMember.name} (${sc.crewMember.position})](/talent/crew/${sc.crewMember.id})`)
      .join(", ");
    return [
      `Shoot day: ${localDate(day.date).toLocaleDateString()}. Call time: ${day.callTime ?? "—"}. Status: ${day.status}.`,
      `Location: ${loc}.`,
      sceneLinks ? `Scenes: ${sceneLinks}.` : "",
      crewLinks ? `Crew: ${crewLinks}.` : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Tasks
  if (pathname === "/production/tasks") {
    const list = await prisma.task.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, title: true, owner: true, status: true },
      orderBy: { createdAt: "desc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (t) => `- ${t.title} — owner: ${t.owner ?? "unassigned"}, status: ${t.status}`
    );
    return `Tasks (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  // Budget
  if (pathname === "/accounting/budget") {
    const rollup = await calculateBudgetRollup(projectId);
    const bucketLines = rollup.buckets.map(
      (b) =>
        `- ${b.name}: ${rollup.currencySymbol}${b.planned.toLocaleString()} planned, ${rollup.currencySymbol}${b.actualSpent.toLocaleString()} actual`
    );
    return [
      `Budget. Total: ${rollup.currencySymbol}${rollup.totalBudget.toLocaleString()}. Remaining: ${rollup.currencySymbol}${rollup.summary.remaining.toLocaleString()}.`,
      `Buckets: ${bucketLines.join("; ")}.`
    ].join(" ");
  }

  // Notes
  if (pathname === "/production/notes") {
    const list = await prisma.note.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, title: true, category: true },
      orderBy: { updatedAt: "desc" },
      take: LIST_CAP
    });
    const lines = list.map(
      (n) => `- ${n.title}${n.category ? ` (${n.category})` : ""} — [detail](/production/notes/${n.id})`
    );
    return `Notes (showing up to ${LIST_CAP}):\n${lines.join("\n")}`;
  }

  const noteIdMatch = pathname.match(/^\/production\/notes\/([a-z0-9]+)$/i);
  if (noteIdMatch) {
    const id = noteIdMatch[1];
    const n = await prisma.note.findFirst({ where: { id, projectId } });
    if (!n) return `Note not found for id ${id}.`;
    return `Note: ${n.title}. Category: ${n.category ?? "—"}. Body (excerpt): ${(n.body ?? "").slice(0, 200)}.`;
  }

  // Gear
  if (pathname === "/production/gear") {
    const models = await prisma.gearModel.findMany({
      where: { projectId, isDeleted: false },
      include: {
        items: { select: { id: true, name: true, category: true, costAmount: true, costType: true, supplier: true } }
      },
      orderBy: { sortOrder: "asc" }
    });
    if (!models.length) return "Gear — no gear models yet.";
    const lines = models.map((m) => {
      const itemCount = m.items.length;
      const totalCost = m.items.reduce((s, i) => s + i.costAmount, 0);
      const planned = m.plannedAmount != null ? `, planned budget ${m.plannedAmount}` : "";
      return `- ${m.name}: ${itemCount} item(s), total cost ${totalCost.toFixed(2)}${planned}${m.isActive ? " [ACTIVE]" : ""}`;
    });
    return `Gear (${models.length} model(s)):\n${lines.join("\n")}`;
  }

  // Catering
  if (pathname === "/production/catering") {
    const days = await prisma.cateringDay.findMany({
      where: { projectId, isDeleted: false },
      include: { meals: { select: { mealType: true, vendor: true, estimatedCost: true, actualCost: true } } },
      orderBy: { date: "asc" },
      take: LIST_CAP
    });
    if (!days.length) return "Catering — no catering days planned yet.";
    const lines = days.map((d) => {
      const dateStr = d.date ? localDate(d.date).toLocaleDateString() : "TBD";
      const mealSummary = d.meals.map((m) => m.mealType).join(", ");
      return `- ${d.label} (${dateStr}) — headcount: ${d.headcount}, meals: ${mealSummary || "none"}`;
    });
    return `Catering (${days.length} day(s)):\n${lines.join("\n")}`;
  }

  // Contacts
  if (pathname === "/talent/contacts") {
    const [castContacts, crewContacts] = await Promise.all([
      prisma.castMember.findMany({
        where: { projectId, isDeleted: false },
        select: { name: true, phone: true, email: true, emergencyContactName: true, emergencyContactPhone: true },
        orderBy: { name: "asc" },
        take: LIST_CAP
      }),
      prisma.crewMember.findMany({
        where: { projectId, isDeleted: false },
        select: { name: true, phone: true, email: true, emergencyContactName: true, emergencyContactPhone: true },
        orderBy: { name: "asc" },
        take: LIST_CAP
      })
    ]);
    const castLines = castContacts.map((c) => `- ${c.name} — phone: ${c.phone ?? "—"}, email: ${c.email ?? "—"}, emergency: ${c.emergencyContactName ?? "—"} ${c.emergencyContactPhone ?? ""}`);
    const crewLines = crewContacts.map((c) => `- ${c.name} — phone: ${c.phone ?? "—"}, email: ${c.email ?? "—"}, emergency: ${c.emergencyContactName ?? "—"} ${c.emergencyContactPhone ?? ""}`);
    const parts: string[] = [];
    if (castLines.length) parts.push(`Cast contacts (${castLines.length}):\n${castLines.join("\n")}`);
    if (crewLines.length) parts.push(`Crew contacts (${crewLines.length}):\n${crewLines.join("\n")}`);
    return parts.length ? parts.join("\n\n") : "Contacts — no cast or crew members yet.";
  }

  // Expenses (line items by bucket)
  if (pathname === "/accounting/expenses") {
    const buckets = await prisma.budgetBucket.findMany({
      where: { projectId },
      include: {
        lineItems: {
          where: { isDeleted: false },
          select: { description: true, plannedAmount: true, actualAmount: true },
          orderBy: { createdAt: "desc" },
          take: 10
        }
      },
      orderBy: { name: "asc" }
    });
    const lines = buckets.map((b) => {
      const totalActual = b.lineItems.reduce((s, li) => s + li.actualAmount, 0);
      const itemList = b.lineItems.map((li) => `  · ${li.description}: planned ${li.plannedAmount}, actual ${li.actualAmount}`).join("\n");
      return `- ${b.name}: ${b.lineItems.length} item(s), actual total ${totalActual.toFixed(2)}${itemList ? "\n" + itemList : ""}`;
    });
    return `Expenses by bucket:\n${lines.join("\n")}`;
  }

  // Other known routes — minimal context
  const known: Record<string, string> = {
    "/script": "Script & Story department — script versions, scenes, and color-coded script.",
    "/script/hub": "Script Hub — current script version and uploads.",
    "/script/color-coded": "Color-coded script view.",
    "/talent": "Talent department — cast, crew, and contacts.",
    "/accounting": "Accounting department — budget and expenses.",
    "/production": "Production Office — schedule, tasks, notes, locations, gear, catering.",
    "/settings": "App settings — project name, theme, etc.",
    "/settings/people": "People — manage site users and project collaborators.",
    "/docs": "Documentation — guides for using indieFilmer.",
  };
  if (known[pathname]) return known[pathname];

  // Docs detail pages
  if (pathname.startsWith("/docs/")) return "Documentation page.";

  return `Page: ${pathname}. No specific context for this route.`;
}

const NAV_LINKS: { path: string; label: string }[] = [
  { path: "/", label: "Dashboard" },
  { path: "/production", label: "Production Office" },
  { path: "/production/schedule", label: "Schedule" },
  { path: "/production/tasks", label: "Tasks" },
  { path: "/production/notes", label: "Notes" },
  { path: "/production/locations", label: "Locations" },
  { path: "/production/gear", label: "Gear" },
  { path: "/production/catering", label: "Catering" },
  { path: "/script", label: "Script & Story" },
  { path: "/script/hub", label: "Script Hub" },
  { path: "/script/scenes", label: "Scenes" },
  { path: "/script/color-coded", label: "Color-Coded Script" },
  { path: "/talent", label: "Talent" },
  { path: "/talent/cast", label: "Cast & Roles" },
  { path: "/talent/crew", label: "Crew" },
  { path: "/talent/contacts", label: "Contacts" },
  { path: "/accounting", label: "Accounting" },
  { path: "/accounting/budget", label: "Budget" },
  { path: "/accounting/expenses", label: "Expenses" },
  { path: "/settings", label: "Settings" },
  { path: "/settings/people", label: "People" },
  { path: "/docs", label: "Docs" }
];

/** Append key:value only when value is truthy. */
function kv(pairs: [string, unknown][]): string {
  return pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(" | ");
}

/**
 * Fetch ALL fields for every active entity so the assistant can answer
 * any question (e.g. "does everyone have an emergency contact?").
 */
export async function getGlobalEntitySummary(projectId: string): Promise<string> {
  const [
    cast, crew, locations, scenes, tasks, shootDays,
    budgetBuckets, notes, lineItems
  ] = await Promise.all([
    prisma.castMember.findMany({
      where: { projectId, isDeleted: false },
      include: {
        sceneAssignments: {
          include: { scene: { select: { sceneNumber: true, isDeleted: true } } }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.crewMember.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { name: "asc" }
    }),
    prisma.location.findMany({
      where: { projectId, isDeleted: false },
      include: {
        scenes: { where: { isDeleted: false }, select: { sceneNumber: true } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.scene.findMany({
      where: { projectId, isDeleted: false },
      include: {
        location: { select: { name: true } },
        tags: { select: { tag: true } },
        castAssignments: {
          include: { castMember: { select: { name: true, isDeleted: true } } }
        }
      },
      orderBy: { sceneNumber: "asc" }
    }),
    prisma.task.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { createdAt: "desc" }
    }),
    prisma.shootDay.findMany({
      where: { projectId, isDeleted: false },
      include: {
        location: { select: { name: true } },
        scenes: { include: { scene: { select: { sceneNumber: true } } } },
        crewMembers: { include: { crewMember: { select: { name: true } } } }
      },
      orderBy: { date: "asc" }
    }),
    prisma.budgetBucket.findMany({
      where: { projectId },
      include: {
        lineItems: {
          where: { isDeleted: false },
          select: { id: true, description: true, plannedAmount: true, actualAmount: true }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.note.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.budgetLineItem.findMany({
      where: { projectId, isDeleted: false },
      select: { id: true, bucketId: true, description: true, plannedAmount: true, actualAmount: true, date: true, notes: true },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const sections: string[] = [];

  // ---- CAST ----
  if (cast.length) {
    const lines = cast.map((c) => {
      const sceneNums = c.sceneAssignments
        .filter((a) => !a.scene.isDeleted)
        .map((a) => a.scene.sceneNumber)
        .join(",");
      const details = kv([
        ["actor", c.actorName],
        ["status", c.status],
        ["phone", c.phone],
        ["email", c.email],
        ["emergencyName", c.emergencyContactName],
        ["emergencyPhone", c.emergencyContactPhone],
        ["emergencyRelation", c.emergencyContactRelation],
        ["dietary", c.dietaryRestrictions],
        ["rate", c.rate],
        ["days", c.days],
        ["flatFee", c.flatFee],
        ["plannedAmount", c.plannedAmount],
        ["castingLink", c.castingLink],
        ["notes", c.notes],
      ]);
      return `- ${c.name}${c.roleName ? ` (${c.roleName})` : ""} | ${details}${sceneNums ? ` | scenes:${sceneNums}` : ""} (id:${c.id})`;
    });
    sections.push(`Cast (${cast.length}):\n${lines.join("\n")}`);
  }

  // ---- CREW ----
  if (crew.length) {
    const lines = crew.map((c) => {
      const details = kv([
        ["position", c.position],
        ["status", c.status],
        ["phone", c.phone],
        ["email", c.email],
        ["emergencyName", c.emergencyContactName],
        ["emergencyPhone", c.emergencyContactPhone],
        ["emergencyRelation", c.emergencyContactRelation],
        ["dietary", c.dietaryRestrictions],
        ["rate", c.rate],
        ["days", c.days],
        ["flatFee", c.flatFee],
        ["plannedAmount", c.plannedAmount],
        ["notes", c.notes],
      ]);
      return `- ${c.name} | ${details} (id:${c.id})`;
    });
    sections.push(`Crew (${crew.length}):\n${lines.join("\n")}`);
  }

  // ---- LOCATIONS ----
  if (locations.length) {
    const lines = locations.map((l) => {
      const sceneNums = l.scenes.map((s) => s.sceneNumber).join(",");
      const details = kv([
        ["address", l.address],
        ["status", l.status],
        ["costPerDay", l.estimatedCostPerDay],
        ["days", l.numberOfDays],
        ["fees", l.fees],
        ["plannedAmount", l.plannedAmount],
        ["costNotes", l.costNotes],
        ["notes", l.notes],
      ]);
      return `- ${l.name} | ${details}${sceneNums ? ` | scenes:${sceneNums}` : ""} (id:${l.id})`;
    });
    sections.push(`Locations (${locations.length}):\n${lines.join("\n")}`);
  }

  // ---- SCENES ----
  if (scenes.length) {
    const lines = scenes.map((s) => {
      const castNames = s.castAssignments
        .filter((a) => !a.castMember.isDeleted)
        .map((a) => a.castMember.name)
        .join(",");
      const tags = s.tags.map((t) => t.tag).join(",");
      const details = kv([
        ["intExt", s.intExt],
        ["dayNight", s.dayNight],
        ["pages", s.pageCount],
        ["location", s.location?.name],
        ["synopsis", s.synopsis ? s.synopsis.slice(0, 120) : null],
      ]);
      return `- Sc ${s.sceneNumber}${s.title ? ` ${s.title}` : ""} | ${details}${castNames ? ` | cast:${castNames}` : ""}${tags ? ` | tags:${tags}` : ""} (id:${s.id})`;
    });
    sections.push(`Scenes (${scenes.length}):\n${lines.join("\n")}`);
  }

  // ---- SHOOT DAYS ----
  if (shootDays.length) {
    const lines = shootDays.map((d) => {
      const sceneNums = d.scenes.map((s) => s.scene.sceneNumber).join(",");
      const crewNames = d.crewMembers.map((c) => c.crewMember.name).join(",");
      const details = kv([
        ["date", localDate(d.date).toLocaleDateString()],
        ["call", d.callTime],
        ["location", d.location?.name],
        ["status", d.status],
        ["notes", d.notes],
      ]);
      return `- ${details}${sceneNums ? ` | scenes:${sceneNums}` : ""}${crewNames ? ` | crew:${crewNames}` : ""} (id:${d.id})`;
    });
    sections.push(`Shoot Days (${shootDays.length}):\n${lines.join("\n")}`);
  }

  // ---- TASKS ----
  if (tasks.length) {
    const lines = tasks.map((t) => {
      const details = kv([
        ["owner", t.owner],
        ["status", t.status],
        ["due", t.dueDate ? new Date(t.dueDate).toLocaleDateString() : null],
        ["notes", t.notes ? t.notes.slice(0, 80) : null],
      ]);
      return `- ${t.title} | ${details} (id:${t.id})`;
    });
    sections.push(`Tasks (${tasks.length}):\n${lines.join("\n")}`);
  }

  // ---- NOTES ----
  if (notes.length) {
    const lines = notes.map((n) => {
      const details = kv([
        ["category", n.category],
        ["body", n.body ? n.body.slice(0, 100) : null],
      ]);
      return `- ${n.title} | ${details} (id:${n.id})`;
    });
    sections.push(`Notes (${notes.length}):\n${lines.join("\n")}`);
  }

  // ---- BUDGET BUCKETS + LINE ITEMS ----
  if (budgetBuckets.length) {
    const lines = budgetBuckets.map((b) => {
      const totalActual = b.lineItems.reduce((s, li) => s + li.actualAmount, 0);
      const itemCount = b.lineItems.length;
      return `- ${b.name}: planned ${b.plannedAmount}, actual ${totalActual}, ${itemCount} item(s) (id:${b.id})`;
    });
    sections.push(`Budget Buckets (${budgetBuckets.length}):\n${lines.join("\n")}`);
  }

  if (lineItems.length) {
    const lines = lineItems.map((li) => {
      const details = kv([
        ["planned", li.plannedAmount],
        ["actual", li.actualAmount],
        ["date", li.date ? localDate(li.date).toLocaleDateString() : null],
        ["notes", li.notes ? li.notes.slice(0, 60) : null],
      ]);
      return `- ${li.description} | ${details} (id:${li.id})`;
    });
    sections.push(`Budget Line Items (${lineItems.length}):\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

export function buildSystemPrompt(
  pageContext: PageContext,
  projectSummary: ProjectSummary,
  globalEntities: string
): string {
  const navBlock = NAV_LINKS.map((l) => `- [${l.label}](${l.path})`).join("\n");
  return `You are a concise in-app assistant for indieFilmer, a microbudget film production planner. The user is on page: ${pageContext.pathname}.

PROJECT SUMMARY:
- Name: ${projectSummary.projectName}
- Budget: ${projectSummary.currencySymbol}${projectSummary.totalBudget.toLocaleString()} total, ${projectSummary.currencySymbol}${projectSummary.remainingBudget.toLocaleString()} remaining
- Scenes: ${projectSummary.scenesScheduled}/${projectSummary.totalScenes} scheduled; Cast: ${projectSummary.rolesCast}/${projectSummary.totalCast} cast; Locations: ${projectSummary.totalLocations}; Crew: ${projectSummary.totalCrew}; Shoot days: ${projectSummary.totalShootDays}; Tasks: ${projectSummary.totalTasks}

PROJECT ENTITIES:
${globalEntities}

CURRENT PAGE CONTEXT:
${pageContext.summary}

AVAILABLE IN-APP PAGES (use these paths for links):
${navBlock}

ACTION CATALOG:
You can propose data changes using action blocks. Format:
\`\`\`action
{"action":"<name>","description":"<human-readable summary>", ...params}
\`\`\`

TASKS (owner: optional user id for assignment, status: Todo|Doing|Done):
  create_task {title, owner?, status?, dueDate?(YYYY-MM-DD), notes?}
  update_task {id, title?, owner?, status?, dueDate?, notes?}
  delete_task {id} / restore_task {id}
  assign_tasks {taskIds[], owner} — bulk
  update_task_statuses {taskIds[], status} — bulk

CAST (status: Confirmed|Pending|Backup|TBD):
  create_cast {name, roleName?, actorName?, status?}
  update_cast {id, name?, roleName?, actorName?, status?}
  delete_cast {id} / restore_cast {id}

CREW (status: Confirmed|Pending|TBD):
  create_crew {name, position, status?}
  update_crew {id, name?, position?, status?}
  delete_crew {id} / restore_crew {id}

SCENES (tags: sound_risk|permit_risk|stunts|intimacy|vfx|special_props|crowd|night_ext):
  create_scene {sceneNumber, title?, intExt?, dayNight?, pages?, synopsis?, locationId?}
  update_scene {id, sceneNumber?, title?, intExt?, dayNight?, pages?, synopsis?, locationId?}
  delete_scene {id} / restore_scene {id}
  add_scene_cast {sceneId, castMemberId} / remove_scene_cast {sceneId, castMemberId}
  toggle_scene_tag {sceneId, tag}

LOCATIONS (status: Shortlist|Contacted|Visited|On Hold|Booked|Rejected):
  create_location {name, address?}
  update_location {id, name?, address?, status?}
  delete_location {id} / restore_location {id}

SCHEDULE (status: Planned|Shooting|Wrapped):
  create_shoot_day {date(YYYY-MM-DD), locationId?, sceneIds?[], callTime?, notes?}
  update_shoot_day {id, date?, callTime?, status?, locationId?, notes?}
  delete_shoot_day {id} / restore_shoot_day {id}
  assign_scenes_to_day {shootDayId, sceneIds[]}
  assign_crew_to_day {shootDayId, crewMemberIds[]}

NOTES:
  create_note {title, category?, body?}
  update_note {id, title?, category?, body?}
  delete_note {id} / restore_note {id}

BUDGET:
  update_total_budget {amount}
  update_bucket_planned {bucketId, amount}
  create_line_item {bucketId, description, plannedAmount?, actualAmount?, date?, notes?}
  update_line_item {id, description?, plannedAmount?, actualAmount?, date?, notes?}
  delete_line_item {id} / restore_line_item {id}

SETTINGS:
  update_project_settings {projectName?, totalBudget?, currencySymbol?}

SUGGEST UI FOR: file uploads, gear management, call sheets, craft services, script versions, contact info editing. Link the user to the relevant page instead.

ACTION RULES:
- ALWAYS describe the specific changes BEFORE the action block
- The action block renders as Confirm/Cancel buttons — the user must click Confirm
- Use exact entity IDs from PROJECT ENTITIES above
- Only propose actions when the user explicitly asks to make changes
- For simple single-field edits (e.g. renaming one item), suggest the user do it in the UI form — it's faster. Use actions for bulk operations, multi-step changes, or when the user specifically asks.
- You may include multiple action blocks in one message for multi-step operations

GUIDELINES:
- Be concise. Prefer short answers; keep replies under 300 words unless the user asks for detail.
- Use Markdown: **bold**, *italic*, \`code\`, and [text](url) for links.
- For in-app navigation use paths like /talent/cast, /script/scenes/abc123, /production/schedule/xyz — they become clickable app links.
- Do not fabricate data. Only reference information from the context above.
- If you don't have enough context, say so and suggest where to look in the app.`;
}
