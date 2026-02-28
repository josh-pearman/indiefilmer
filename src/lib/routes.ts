/**
 * Single source of truth for all application URL paths.
 * Import from here instead of hardcoding path strings.
 */
export const ROUTES = {
  // Home
  home: "/",

  // Production Office
  production: "/production",
  schedule: "/production/schedule",
  scheduleDetail: (id: string) => `/production/schedule/${id}`,
  callSheet: (id: string) => `/production/schedule/${id}/call-sheet`,
  tasks: "/production/tasks",
  notes: "/production/notes",
  noteDetail: (id: string) => `/production/notes/${id}`,

  // Script & Story
  script: "/script",
  scriptHub: "/script/hub",
  scenes: "/script/scenes",
  sceneDetail: (id: string) => `/script/scenes/${id}`,
  colorCoded: "/script/color-coded",

  // Talent
  talent: "/talent",
  cast: "/talent/cast",
  castDetail: (id: string) => `/talent/cast/${id}`,
  crew: "/talent/crew",
  crewDetail: (id: string) => `/talent/crew/${id}`,
  contacts: "/talent/contacts",

  // Locations (under production)
  locations: "/production/locations",
  locationDetail: (id: string) => `/production/locations/${id}`,

  // Gear (under production)
  gear: "/production/gear",

  // Catering (under production, replaces craft-services)
  catering: "/production/catering",

  // Accounting
  accounting: "/accounting",
  budget: "/accounting/budget",
  expenses: "/accounting/expenses",

  // Settings / Auth (unchanged)
  settings: "/settings",
  projects: "/projects",
} as const;
