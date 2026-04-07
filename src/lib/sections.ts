/**
 * Section keys and access control for Phase 3 collaboration.
 * Valid section keys from MULTI_TENANCY_PLAN.md.
 */

export const SECTION_KEYS = [
  "dashboard",
  "script",
  "cast",
  "crew",
  "contacts",
  "scenes",
  "locations",
  "gear",
  "craft-services",
  "schedule",
  "budget",
  "tasks",

  "notes",
  "activity",
  "settings"
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  dashboard: "Dashboard",
  script: "Script Hub",
  cast: "Cast & Roles",
  crew: "Crew",
  contacts: "Contacts",
  scenes: "Scenes",
  locations: "Locations",
  gear: "Gear",
  "craft-services": "Craft Services",
  schedule: "Schedule",
  budget: "Budget",
  tasks: "Tasks",

  notes: "Notes",
  activity: "Activity",
  settings: "Settings"
};

/**
 * Maps route path patterns (normalized, no trailing slash) to section keys.
 * Updated for department-based URL structure.
 */
const ROUTE_TO_SECTION: Record<string, SectionKey> = {
  "/": "dashboard",
  // Production Office
  "/production": "dashboard",
  "/production/schedule": "schedule",
  "/production/tasks": "tasks",
  "/production/notes": "notes",
  // Script & Story
  "/script": "script",
  "/script/hub": "script",
  "/script/scenes": "scenes",
  "/script/color-coded": "script",
  // Talent
  "/talent": "cast",
  "/talent/cast": "cast",
  "/talent/crew": "crew",
  "/talent/contacts": "contacts",
  "/production/locations": "locations",
  "/production/gear": "gear",
  "/production/catering": "craft-services",
  // Accounting
  "/accounting": "budget",
  "/accounting/budget": "budget",
  "/accounting/expenses": "budget",
  // Settings
  "/settings": "settings"
};

/**
 * Resolves a URL pathname to its section key.
 * Handles dynamic segments under the new department-based URL structure.
 */
export function getSectionForPath(pathname: string): SectionKey | null {
  const normalized = pathname.replace(/\/$/, "") || "/";
  // Try exact match first
  if (ROUTE_TO_SECTION[normalized] !== undefined) {
    return ROUTE_TO_SECTION[normalized] as SectionKey;
  }
  // Dynamic segments under new structure
  if (/^\/talent\/cast\/[^/]+$/.test(normalized)) return "cast";
  if (/^\/talent\/crew\/[^/]+$/.test(normalized)) return "crew";
  if (/^\/script\/scenes\/[^/]+$/.test(normalized)) return "scenes";
  if (/^\/production\/locations\/[^/]+$/.test(normalized)) return "locations";
  if (/^\/production\/schedule\/[^/]+\/call-sheet$/.test(normalized)) return "schedule";
  if (/^\/production\/schedule\/[^/]+$/.test(normalized)) return "schedule";
  if (/^\/production\/notes\/[^/]+$/.test(normalized)) return "notes";
  // Prefix match for department roots
  if (normalized.startsWith("/production")) return "dashboard";
  if (normalized.startsWith("/script")) return "script";
  if (normalized.startsWith("/talent")) return "cast";
  if (normalized.startsWith("/accounting")) return "budget";
  // Final fallback: base segment match
  const segments = normalized.split("/").filter(Boolean);
  const base = "/" + (segments[0] ?? "");
  return (ROUTE_TO_SECTION[base] as SectionKey) ?? null;
}

export type ProjectMemberLike = {
  role: string;
  allowedSections: string;
};

/**
 * Returns true if the member has access to the given section.
 * Admins have access to everything. Collaborators need the section in allowedSections.
 */
export function hasAccess(member: ProjectMemberLike, section: string): boolean {
  if (member.role === "admin") return true;
  const sections = parseAllowedSections(member.allowedSections);
  return sections.includes(section);
}

/**
 * Safely parse allowedSections JSON string to string array.
 */
export function parseAllowedSections(json: string): string[] {
  if (!json || typeof json !== "string") return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string");
  } catch {
    return [];
  }
}

/** Maps section keys to their default route, used to redirect users to their first allowed section. */
const SECTION_TO_ROUTE: Partial<Record<SectionKey, string>> = {
  dashboard: "/",
  schedule: "/production/schedule",
  tasks: "/production/tasks",
  notes: "/production/notes",
  locations: "/production/locations",
  gear: "/production/gear",
  "craft-services": "/production/catering",
  script: "/script/hub",
  scenes: "/script/scenes",
  cast: "/talent/cast",
  crew: "/talent/crew",
  contacts: "/talent/contacts",
  budget: "/accounting/budget",
  activity: "/",
};

/**
 * Returns the URL of the first section the member has access to.
 * Falls back to "/" if nothing matches.
 */
export function getFirstAllowedRoute(member: ProjectMemberLike): string {
  if (member.role === "admin") return "/";
  const sections = parseAllowedSections(member.allowedSections);
  for (const section of sections) {
    const route = SECTION_TO_ROUTE[section as SectionKey];
    if (route) return route;
  }
  return "/";
}
