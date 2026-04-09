import { z } from "zod";

export const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
  confirmPassword: z.string().min(1, "Please confirm your new password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─── Schedule ─────────────────────────────────────────────

export const createShootDaySchema = z.object({
  date: z.string().min(1, "Date is required"),
  callTime: z.string().optional(),
  locationId: z.string().min(1, "Location is required"),
  status: z.enum(["Planned", "Shooting", "Wrapped"]).default("Planned"),
  notes: z.string().optional().or(z.literal("")),
  sceneIds: z.array(z.string()).default([]),
  meals: z.number().nonnegative().optional(),
  transport: z.number().nonnegative().optional(),
  misc: z.number().nonnegative().optional(),
  budgetBucket: z.string().optional()
});

export const updateShootDaySchema = createShootDaySchema.partial().extend({
  id: z.string().min(1, "Shoot day ID is required")
});

export const assignScenesToDaySchema = z.object({
  shootDayId: z.string().min(1),
  sceneIds: z.array(z.string()).default([]) // ordered; index = sortOrder
});

export const updateShootDayScenesSchema = assignScenesToDaySchema;

export const assignCrewToDaySchema = z.object({
  shootDayId: z.string().min(1),
  crewMemberIds: z.array(z.string()).default([])
});

export const reorderDayScenesSchema = z.object({
  shootDayId: z.string().min(1),
  sceneIds: z.array(z.string()).min(0) // new order of scene IDs
});

// ─── Call Sheet ───────────────────────────────────────────

export const updateCallSheetSchema = z.object({
  generalCallTime: z.string().optional(),
  announcements: z.string().optional(),
  weatherSummary: z.string().optional(),
  sunrise: z.string().optional(),
  sunset: z.string().optional(),
  nearestHospital: z.string().optional(),
  emergencyContact: z.string().optional(),
  personalCallTimes: z.string().optional()
});

export const updateCallSheetCrewSchema = z.object({
  callSheetId: z.string().min(1),
  crew: z.array(
    z.object({
      crewId: z.string().min(1),
      callTime: z.string().optional()
    })
  )
});

export const sendCallSheetEmailsSchema = z.object({
  callSheetId: z.string().min(1),
  recipients: z.array(z.string().email("Must be a valid email")).min(1, "Select at least one recipient"),
  subject: z.string().trim().min(1, "Subject is required"),
  body: z.string().trim().min(1, "Body is required")
});

// ─── Script Versions ─────────────────────────────────────

export const createScriptVersionSchema = z.object({
  versionLabel: z.string().min(1, "Version label is required"),
  pageCount: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  setAsCurrent: z.string().optional() // "on" or undefined from checkbox
});

export const updateScriptVersionSchema = z.object({
  id: z.string().min(1),
  versionLabel: z.string().min(1, "Version label is required"),
  pageCount: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

// ─── Locations ───────────────────────────────────────────

const locationStatusEnum = z.enum([
  "Shortlist",
  "Contacted",
  "Visited",
  "On Hold",
  "Booked",
  "Rejected"
]);
const providerTypeEnum = z.enum(["Peerspace", "Giggster", "Other"]);

export const createLocationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  providerType: providerTypeEnum.optional(),
  providerLink: z
    .union([z.string().url("Must be a valid URL"), z.literal("")])
    .optional(),
  status: locationStatusEnum.default("Shortlist"),
  estimatedCostPerDay: z.number().nonnegative().optional(),
  numberOfDays: z.number().nonnegative().optional(),
  fees: z.number().nonnegative().optional(),
  costNotes: z.string().optional(),
  plannedAmount: z.number().nonnegative().optional(),
  budgetBucket: z.string().optional(),
  notes: z.string().optional()
});

export const updateLocationSchema = createLocationSchema.partial().extend({
  id: z.string().min(1, "Location ID is required")
});

export const updateLocationStatusSchema = z.object({
  id: z.string().min(1),
  status: locationStatusEnum
});


// ─── Tasks ───────────────────────────────────────────────────

export const TASK_STATUSES = ["Todo", "Doing", "Done"] as const;
export const TASK_PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export const TASK_CATEGORIES = ["camera", "sound", "art", "locations", "permits", "post", "general"] as const;

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(500, "Title too long"),
  owner: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(TASK_STATUSES).default("Todo"),
  priority: z.enum(TASK_PRIORITIES).default("none"),
  category: z.enum(TASK_CATEGORIES).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  notes: z.string().max(5000, "Notes too long").optional().or(z.literal("")),
  sourceNoteId: z.string().optional().or(z.literal(""))
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().min(1, "Task ID is required")
});

export const updateTaskStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(TASK_STATUSES)
});

export const taskLinkSchema = z.object({
  taskId: z.string().min(1),
  label: z.string().min(1, "Label is required"),
  url: z.string().url("Must be a valid URL")
});

// ─── Notes ─────────────────────────────────────────────────

export const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  category: z.string().optional().or(z.literal("")),
  body: z.string().optional().or(z.literal(""))
});

export const updateNoteSchema = createNoteSchema.partial().extend({
  id: z.string().min(1)
});

export const noteLinkSchema = z.object({
  noteId: z.string().min(1),
  label: z.string().min(1, "Label is required"),
  url: z.string().url("Must be a valid URL")
});

export const convertNoteToTaskSchema = z.object({
  noteId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  owner: z.string().optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal(""))
});

// ─── Scenes ───────────────────────────────────────────────

const sceneTagEnum = z.enum([
  "sound_risk",
  "permit_risk",
  "stunts",
  "intimacy",
  "vfx",
  "special_props",
  "crowd",
  "night_ext"
]);

export const createSceneSchema = z.object({
  sceneNumber: z.string().min(1, "Scene number is required"),
  title: z.string().optional(),
  intExt: z.enum(["INT", "EXT"]).optional(),
  dayNight: z.enum(["DAY", "NIGHT"]).optional(),
  pageCount: z.number().nonnegative().optional(),
  synopsis: z.string().optional(),
  shotlistPath: z.string().optional(),
  locationId: z.string().optional().or(z.literal(""))
});

export const updateSceneSchema = createSceneSchema.partial().extend({
  id: z.string().min(1, "Scene ID is required")
});

export const toggleSceneTagSchema = z.object({
  sceneId: z.string().min(1),
  tag: sceneTagEnum
});

export const sceneCastSchema = z.object({
  sceneId: z.string().min(1),
  castMemberId: z.string().min(1)
});

// ─── Intake ───────────────────────────────────────────────

export const intakeFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().or(z.literal("")),
  email: z.union([z.string().email("Must be a valid email"), z.literal("")]).optional(),
  emergencyContactName: z.string().optional().or(z.literal("")),
  emergencyContactPhone: z.string().optional().or(z.literal("")),
  emergencyContactRelation: z.string().optional().or(z.literal("")),
  dietaryRestrictions: z.string().optional().or(z.literal("")),
  includePhoneOnCallSheet: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
  includeEmailOnCallSheet: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
});

export type IntakeFormInput = z.infer<typeof intakeFormSchema>;

// ─── Cast ─────────────────────────────────────────────────

const castStatusEnum = z.enum(["Confirmed", "Pending", "Backup", "TBD"]);

export const createCastMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roleName: z.string().optional(),
  actorName: z.string().optional().or(z.literal("")),
  castingLink: z
    .union([z.string().url("Must be a valid URL"), z.literal("")])
    .optional(),
  status: castStatusEnum.default("TBD"),
  phone: z.string().optional(),
  email: z.union([z.string().email("Must be a valid email"), z.literal("")]).optional(),
  includePhoneOnCallSheet: z.boolean().default(true),
  includeEmailOnCallSheet: z.boolean().default(true),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  notes: z.string().optional(),
  rate: z.number().nonnegative().optional(),
  days: z.number().nonnegative().optional(),
  flatFee: z.number().nonnegative().optional(),
  plannedAmount: z.number().nonnegative().optional(),
  budgetBucket: z.string().optional()
});

export const updateCastMemberSchema = createCastMemberSchema.partial().extend({
  id: z.string().min(1, "Cast member ID is required")
});

// ─── Crew ─────────────────────────────────────────────────

const crewStatusEnum = z.enum(["Confirmed", "Pending", "TBD"]);

export const createCrewMemberSchema = z.object({
  name: z.string().default(""),
  position: z.string().min(1, "Position is required"),
  phone: z.string().optional(),
  email: z.union([z.string().email("Must be a valid email"), z.literal("")]).optional(),
  includePhoneOnCallSheet: z.boolean().default(true),
  includeEmailOnCallSheet: z.boolean().default(true),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  status: crewStatusEnum.default("TBD"),
  notes: z.string().optional(),
  rate: z.number().nonnegative().optional(),
  days: z.number().nonnegative().optional(),
  flatFee: z.number().nonnegative().optional(),
  plannedAmount: z.number().nonnegative().optional(),
  budgetBucket: z.string().optional()
});

export const updateCrewMemberSchema = createCrewMemberSchema.partial().extend({
  id: z.string().min(1, "Crew member ID is required")
});

// ─── Craft Services ────────────────────────────────────────

export const updateShootDayMealSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  vendor: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional().nullable(),
  actualCost: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional()
});

export const createCateringDaySchema = z.object({
  date: z.string().optional().or(z.literal("")),
  label: z.string().min(1, "Label is required"),
  locationName: z.string().optional().or(z.literal("")),
  headcount: z.coerce.number().int().nonnegative().default(0)
});

export const updateCateringDaySchema = z.object({
  id: z.string().min(1),
  date: z.string().optional(),
  label: z.string().optional(),
  locationName: z.string().optional().nullable(),
  headcount: z.coerce.number().int().nonnegative().optional()
});

export const updateCateringDayMealSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  vendor: z.string().optional(),
  estimatedCost: z.number().nonnegative().optional().nullable(),
  actualCost: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional()
});

// ─── Gear ─────────────────────────────────────────────────

export const updateGearModelNameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Model name is required")
});

export const gearItemCategoryEnum = z.enum([
  "Camera",
  "Grip",
  "Audio",
  "Lighting",
  "Power",
  "Monitoring",
  "Other"
]);

export const updateGearItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  category: gearItemCategoryEnum.optional(),
  costAmount: z.number().nonnegative().optional(),
  costType: z.enum(["per_day", "flat_rate"]).optional(),
  supplier: z.string().optional()
});

export const toggleGearItemDaySchema = z.object({
  gearItemId: z.string().min(1),
  shootDayId: z.string().min(1)
});

// ─── Shots ─────────────────────────────────────────────────

export const createShotSchema = z.object({
  sceneId: z.string().min(1, "Scene is required"),
  shotNumber: z.string().min(1, "Shot number is required"),
  shotSize: z.string().optional().or(z.literal("")),
  shotType: z.string().optional().or(z.literal("")),
  cameraAngle: z.string().optional().or(z.literal("")),
  cameraMovement: z.string().optional().or(z.literal("")),
  lens: z.string().optional().or(z.literal("")),
  equipment: z.string().optional().or(z.literal("")),
  description: z.string().min(1, "Description is required"),
  subjectOrFocus: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal(""))
});

export const updateShotSchema = createShotSchema.partial().extend({
  id: z.string().min(1, "Shot ID is required")
});

export const reorderShotsSchema = z.object({
  sceneId: z.string().min(1),
  shotIds: z.array(z.string()).min(0)
});

// ─── Shot list import ──────────────────────────────────────

export const importedShotSchema = z.object({
  sceneNumber: z.string().min(1, "Scene number is required"),
  shotNumber: z.string().min(1, "Shot number is required"),
  shotSize: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  shotType: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  cameraAngle: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  cameraMovement: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  lens: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  equipment: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  description: z.string().min(1, "Description is required"),
  subjectOrFocus: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  notes: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
});

export const importShotsSchema = z.object({
  shots: z
    .array(importedShotSchema)
    .min(1, "At least one shot is required")
});

// ─── Script extraction import ──────────────────────────────

export const importedLocationSchema = z.object({
  locationName: z.string().min(1, "Location name is required")
});

export const importedCastSchema = z.object({
  characterName: z.string().min(1, "Character name is required"),
  roleName: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)
});

export const importedSceneSchema = z.object({
  sceneNumber: z.string().min(1, "Scene number is required"),
  title: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  intExt: z
    .enum(["INT", "EXT"])
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  dayNight: z
    .enum(["DAY", "NIGHT"])
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  pageCount: z
    .number()
    .nonnegative()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  synopsis: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  locationName: z
    .string()
    .optional()
    .nullable()
    .transform((v) => v ?? undefined),
  characters: z.array(z.string()).optional().default([]),
  tags: z
    .array(
      z.enum([
        "sound_risk",
        "permit_risk",
        "stunts",
        "intimacy",
        "vfx",
        "special_props",
        "crowd",
        "night_ext"
      ])
    )
    .optional()
    .default([])
});

export const importScenesAndCastSchema = z.object({
  locations: z
    .array(importedLocationSchema)
    .min(1, "At least one location is required"),
  cast: z
    .array(importedCastSchema)
    .min(1, "At least one cast member is required"),
  scenes: z
    .array(importedSceneSchema)
    .min(1, "At least one scene is required")
});

// ─── Budget ─────────────────────────────────────────────────

export const updateTotalBudgetSchema = z.object({
  amount: z.number().nonnegative("Budget must be non-negative")
});

export const updateBucketPlannedSchema = z.object({
  bucketId: z.string().min(1),
  amount: z.number().nonnegative("Amount must be non-negative")
});

export const createLineItemSchema = z.object({
  bucketId: z.string().min(1, "Bucket is required"),
  description: z.string().min(1, "Description is required"),
  plannedAmount: z.number().nonnegative().optional(),
  actualAmount: z.number().nonnegative("Actual amount is required"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional()
});

export const updateLineItemSchema = createLineItemSchema.partial().extend({
  id: z.string().min(1)
});

// ─── Settings ─────────────────────────────────────────────

export const updateProjectSettingsSchema = z.object({
  projectName: z.string().min(1, "Project name is required").optional(),
  totalBudget: z.number().nonnegative().optional(),
  currencySymbol: z.string().min(1).max(5).optional()
});

export const updateCraftServicesDefaultsSchema = z.object({
  craftyPerPerson: z.number().nonnegative(),
  lunchPerPerson: z.number().nonnegative(),
  dinnerPerPerson: z.number().nonnegative(),
  craftyEnabledByDefault: z.boolean(),
  lunchEnabledByDefault: z.boolean(),
  dinnerEnabledByDefault: z.boolean()
});

export const updateUserThemeSchema = z.object({
  colorTheme: z.enum(["light", "dark", "warm"])
});

export const resetProjectSchema = z.object({
  confirmationName: z.string().min(1)
});
