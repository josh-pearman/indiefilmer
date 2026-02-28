import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser, getPerformedBy } from "@/lib/auth";
import { getCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { isChatEnabled } from "@/lib/chat-provider";
import type { SectionKey } from "@/lib/sections";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("chat-actions");

/** Map chat action names to section keys for permission check. */
const ACTION_SECTION_MAP: Record<string, SectionKey> = {
  assign_tasks: "tasks",
  update_task_statuses: "tasks",
  create_task: "tasks",
  update_task: "tasks",
  delete_task: "tasks",
  restore_task: "tasks",
  create_cast: "cast",
  update_cast: "cast",
  delete_cast: "cast",
  restore_cast: "cast",
  create_crew: "crew",
  update_crew: "crew",
  delete_crew: "crew",
  restore_crew: "crew",
  create_scene: "scenes",
  update_scene: "scenes",
  delete_scene: "scenes",
  restore_scene: "scenes",
  add_scene_cast: "scenes",
  remove_scene_cast: "scenes",
  toggle_scene_tag: "scenes",
  create_location: "locations",
  update_location: "locations",
  delete_location: "locations",
  restore_location: "locations",
  create_shoot_day: "schedule",
  update_shoot_day: "schedule",
  delete_shoot_day: "schedule",
  restore_shoot_day: "schedule",
  assign_scenes_to_day: "schedule",
  assign_crew_to_day: "schedule",

  create_note: "notes",
  update_note: "notes",
  delete_note: "notes",
  restore_note: "notes",
  update_total_budget: "budget",
  update_bucket_planned: "budget",
  create_line_item: "budget",
  update_line_item: "budget",
  delete_line_item: "budget",
  restore_line_item: "budget",
  update_project_settings: "settings"
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

type P = Record<string, unknown>;

function requireStr(p: P, key: string): string {
  const v = p[key];
  if (typeof v !== "string" || !v.trim()) throw new Error(`Missing: ${key}`);
  return v.trim();
}

function optStr(p: P, key: string): string | undefined {
  const v = p[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function optNum(p: P, key: string): number | undefined {
  const v = p[key];
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (isNaN(n)) throw new Error(`${key} must be a number`);
  return n;
}

function requireArr(p: P, key: string): string[] {
  const v = p[key];
  if (!Array.isArray(v) || !v.length) throw new Error(`Missing: ${key} (array)`);
  return v as string[];
}

function optDate(p: P, key: string): Date | undefined {
  const v = optStr(p, key);
  if (!v) return undefined;
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new Error(`${key} must be a valid date`);
  return d;
}

function oneOf(val: string, allowed: string[], label: string): string {
  if (!allowed.includes(val)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return val;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_STATUSES = ["Todo", "Doing", "Done"];
const CAST_STATUSES = ["Confirmed", "Pending", "Backup", "TBD"];
const CREW_STATUSES = ["Confirmed", "Pending", "TBD"];
const LOCATION_STATUSES = ["Shortlist", "Contacted", "Visited", "On Hold", "Booked", "Rejected"];
const SHOOT_DAY_STATUSES = ["Planned", "Shooting", "Wrapped"];
const SCENE_TAGS = ["sound_risk", "permit_risk", "stunts", "intimacy", "vfx", "special_props", "crowd", "night_ext"];

// ---------------------------------------------------------------------------
// Action handlers — each returns a success message string
// ---------------------------------------------------------------------------

type Handler = (p: P, user: string, projectId: string) => Promise<string>;

const handlers: Record<string, Handler> = {

  // ---- TASKS (bulk) ----

  assign_tasks: async (p, _user, projectId) => {
    const ids = requireArr(p, "taskIds");
    const owner = requireStr(p, "owner");
    const r = await prisma.task.updateMany({
      where: { id: { in: ids }, projectId, isDeleted: false },
      data: { owner }
    });
    return `Assigned ${r.count} task(s).`;
  },

  update_task_statuses: async (p, _user, projectId) => {
    const ids = requireArr(p, "taskIds");
    const status = oneOf(requireStr(p, "status"), TASK_STATUSES, "status");
    const r = await prisma.task.updateMany({
      where: { id: { in: ids }, projectId, isDeleted: false },
      data: { status }
    });
    return `Updated ${r.count} task(s) to "${status}".`;
  },

  // ---- TASKS (single) ----

  create_task: async (p, user, projectId) => {
    const title = requireStr(p, "title");
    const task = await prisma.task.create({
      data: {
        projectId,
        title,
        owner: optStr(p, "owner") ?? undefined,
        status: optStr(p, "status") ? oneOf(optStr(p, "status")!, TASK_STATUSES, "status") : "Todo",
        dueDate: optDate(p, "dueDate"),
        notes: optStr(p, "notes"),
      }
    });
    await logAudit({ action: "create", entityType: "Task", entityId: task.id, after: task, performedBy: user, projectId });
    return `Created task "${title}" (id: ${task.id}).`;
  },

  update_task: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.task.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Task not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "title")) data.title = optStr(p, "title");
    if (optStr(p, "owner")) data.owner = optStr(p, "owner")!;
    if (optStr(p, "status")) data.status = oneOf(optStr(p, "status")!, TASK_STATUSES, "status");
    if (p.dueDate !== undefined) data.dueDate = optDate(p, "dueDate") ?? null;
    if (optStr(p, "notes") !== undefined) data.notes = optStr(p, "notes") ?? null;
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.task.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "Task", entityId: id, before, after, performedBy: user, projectId });
    return `Updated task "${after.title}".`;
  },

  delete_task: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.task.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Task not found");
    await prisma.task.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "Task", entityId: id, performedBy: user, projectId });
    return `Deleted task.`;
  },

  restore_task: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.task.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Task not found");
    await prisma.task.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "Task", entityId: id, performedBy: user, projectId });
    return `Restored task.`;
  },

  // ---- CAST ----

  create_cast: async (p, user, projectId) => {
    const name = requireStr(p, "name");
    const cast = await prisma.castMember.create({
      data: {
        projectId,
        name,
        roleName: optStr(p, "roleName"),
        actorName: optStr(p, "actorName"),
        status: optStr(p, "status") ? oneOf(optStr(p, "status")!, CAST_STATUSES, "status") : "TBD",
      }
    });
    await logAudit({ action: "create", entityType: "CastMember", entityId: cast.id, after: cast, performedBy: user, projectId });
    return `Created cast member "${name}" (id: ${cast.id}).`;
  },

  update_cast: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.castMember.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Cast member not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "name")) data.name = optStr(p, "name");
    if (optStr(p, "roleName") !== undefined) data.roleName = optStr(p, "roleName") ?? null;
    if (optStr(p, "actorName") !== undefined) data.actorName = optStr(p, "actorName") ?? null;
    if (optStr(p, "status")) data.status = oneOf(optStr(p, "status")!, CAST_STATUSES, "status");
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.castMember.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "CastMember", entityId: id, before, after, performedBy: user, projectId });
    return `Updated cast member "${after.name}".`;
  },

  delete_cast: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.castMember.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Cast member not found");
    await prisma.castMember.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "CastMember", entityId: id, performedBy: user, projectId });
    return `Deleted cast member.`;
  },

  restore_cast: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.castMember.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Cast member not found");
    await prisma.castMember.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "CastMember", entityId: id, performedBy: user, projectId });
    return `Restored cast member.`;
  },

  // ---- CREW ----

  create_crew: async (p, user, projectId) => {
    const name = requireStr(p, "name");
    const crew = await prisma.crewMember.create({
      data: {
        projectId,
        name,
        position: requireStr(p, "position"),
        status: optStr(p, "status") ? oneOf(optStr(p, "status")!, CREW_STATUSES, "status") : "TBD",
      }
    });
    await logAudit({ action: "create", entityType: "CrewMember", entityId: crew.id, after: crew, performedBy: user, projectId });
    return `Created crew member "${name}" (id: ${crew.id}).`;
  },

  update_crew: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.crewMember.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Crew member not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "name")) data.name = optStr(p, "name");
    if (optStr(p, "position")) data.position = optStr(p, "position");
    if (optStr(p, "status")) data.status = oneOf(optStr(p, "status")!, CREW_STATUSES, "status");
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.crewMember.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "CrewMember", entityId: id, before, after, performedBy: user, projectId });
    return `Updated crew member "${after.name}".`;
  },

  delete_crew: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.crewMember.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Crew member not found");
    await prisma.crewMember.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "CrewMember", entityId: id, performedBy: user, projectId });
    return `Deleted crew member.`;
  },

  restore_crew: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.crewMember.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Crew member not found");
    await prisma.crewMember.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "CrewMember", entityId: id, performedBy: user, projectId });
    return `Restored crew member.`;
  },

  // ---- SCENES ----

  create_scene: async (p, user, projectId) => {
    const sceneNumber = requireStr(p, "sceneNumber");
    const locationId = optStr(p, "locationId");
    if (locationId) {
      const location = await prisma.location.findFirst({ where: { id: locationId, projectId, isDeleted: false } });
      if (!location) throw new Error("Location not found");
    }
    const scene = await prisma.scene.create({
      data: {
        projectId,
        sceneNumber,
        title: optStr(p, "title"),
        intExt: optStr(p, "intExt"),
        dayNight: optStr(p, "dayNight"),
        pageCount: optNum(p, "pages"),
        synopsis: optStr(p, "synopsis"),
        locationId,
      }
    });
    await logAudit({ action: "create", entityType: "Scene", entityId: scene.id, after: scene, performedBy: user, projectId });
    return `Created scene ${sceneNumber}${scene.title ? ` "${scene.title}"` : ""} (id: ${scene.id}).`;
  },

  update_scene: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.scene.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Scene not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "sceneNumber")) data.sceneNumber = optStr(p, "sceneNumber");
    if (optStr(p, "title") !== undefined) data.title = optStr(p, "title") ?? null;
    if (optStr(p, "intExt")) data.intExt = optStr(p, "intExt");
    if (optStr(p, "dayNight")) data.dayNight = optStr(p, "dayNight");
    if (p.pages !== undefined) data.pageCount = optNum(p, "pages") ?? null;
    if (optStr(p, "synopsis") !== undefined) data.synopsis = optStr(p, "synopsis") ?? null;
    if (optStr(p, "locationId") !== undefined) {
      const locationId = optStr(p, "locationId");
      if (locationId) {
        const location = await prisma.location.findFirst({ where: { id: locationId, projectId, isDeleted: false } });
        if (!location) throw new Error("Location not found");
      }
      data.locationId = locationId ?? null;
    }
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.scene.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "Scene", entityId: id, before, after, performedBy: user, projectId });
    return `Updated scene ${after.sceneNumber}.`;
  },

  delete_scene: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.scene.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Scene not found");
    await prisma.scene.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "Scene", entityId: id, performedBy: user, projectId });
    return `Deleted scene.`;
  },

  restore_scene: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.scene.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Scene not found");
    await prisma.scene.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "Scene", entityId: id, performedBy: user, projectId });
    return `Restored scene.`;
  },

  add_scene_cast: async (p, user, projectId) => {
    const sceneId = requireStr(p, "sceneId");
    const castMemberId = requireStr(p, "castMemberId");
    const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId, isDeleted: false } });
    if (!scene) throw new Error("Scene not found");
    const cast = await prisma.castMember.findFirst({ where: { id: castMemberId, projectId, isDeleted: false } });
    if (!cast) throw new Error("Cast member not found");
    const existing = await prisma.sceneCast.findFirst({ where: { sceneId, castMemberId } });
    if (existing) return `Cast member already assigned to this scene.`;
    await prisma.sceneCast.create({ data: { sceneId, castMemberId } });
    await logAudit({ action: "update", entityType: "Scene", entityId: sceneId, changeNote: `Added cast member ${castMemberId}`, performedBy: user, projectId });
    return `Added cast member to scene.`;
  },

  remove_scene_cast: async (p, user, projectId) => {
    const sceneId = requireStr(p, "sceneId");
    const castMemberId = requireStr(p, "castMemberId");
    const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
    if (!scene) throw new Error("Scene not found");
    const cast = await prisma.castMember.findFirst({ where: { id: castMemberId, projectId } });
    if (!cast) throw new Error("Cast member not found");
    await prisma.sceneCast.deleteMany({ where: { sceneId, castMemberId } });
    await logAudit({ action: "update", entityType: "Scene", entityId: sceneId, changeNote: `Removed cast member ${castMemberId}`, performedBy: user, projectId });
    return `Removed cast member from scene.`;
  },

  toggle_scene_tag: async (p, _user, projectId) => {
    const sceneId = requireStr(p, "sceneId");
    const tag = oneOf(requireStr(p, "tag"), SCENE_TAGS, "tag");
    const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
    if (!scene) throw new Error("Scene not found");
    const existing = await prisma.sceneTag.findFirst({ where: { sceneId, tag } });
    if (existing) {
      await prisma.sceneTag.delete({ where: { id: existing.id } });
      return `Removed tag "${tag}" from scene.`;
    }
    await prisma.sceneTag.create({ data: { sceneId, tag } });
    return `Added tag "${tag}" to scene.`;
  },

  // ---- LOCATIONS ----

  create_location: async (p, user, projectId) => {
    const name = requireStr(p, "name");
    const loc = await prisma.location.create({
      data: {
        projectId,
        name,
        address: optStr(p, "address"),
        status: optStr(p, "status") ? oneOf(optStr(p, "status")!, LOCATION_STATUSES, "status") : "Shortlist",
      }
    });
    // Create default venue
    await prisma.locationVenue.create({
      data: { locationId: loc.id, label: "Default" }
    });
    await logAudit({ action: "create", entityType: "Location", entityId: loc.id, after: loc, performedBy: user, projectId });
    return `Created location "${name}" (id: ${loc.id}).`;
  },

  update_location: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.location.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Location not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "name")) data.name = optStr(p, "name");
    if (optStr(p, "address") !== undefined) data.address = optStr(p, "address") ?? null;
    if (optStr(p, "status")) data.status = oneOf(optStr(p, "status")!, LOCATION_STATUSES, "status");
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.location.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "Location", entityId: id, before, after, performedBy: user, projectId });
    return `Updated location "${after.name}".`;
  },

  delete_location: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.location.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Location not found");
    await prisma.location.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "Location", entityId: id, performedBy: user, projectId });
    return `Deleted location.`;
  },

  restore_location: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.location.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Location not found");
    await prisma.location.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "Location", entityId: id, performedBy: user, projectId });
    return `Restored location.`;
  },

  // ---- SCHEDULE ----

  create_shoot_day: async (p, user, projectId) => {
    const date = optDate(p, "date");
    if (!date) throw new Error("Missing: date");
    const locationId = optStr(p, "locationId");
    if (locationId) {
      const location = await prisma.location.findFirst({ where: { id: locationId, projectId, isDeleted: false } });
      if (!location) throw new Error("Location not found");
    }
    const day = await prisma.shootDay.create({
      data: {
        projectId,
        date,
        callTime: optStr(p, "callTime"),
        status: optStr(p, "status") ? oneOf(optStr(p, "status")!, SHOOT_DAY_STATUSES, "status") : "Planned",
        locationId,
        notes: optStr(p, "notes"),
      }
    });
    // Assign scenes if provided
    const sceneIds = p.sceneIds;
    if (Array.isArray(sceneIds) && sceneIds.length) {
      const validScenes = await prisma.scene.count({
        where: { id: { in: sceneIds as string[] }, projectId, isDeleted: false }
      });
      if (validScenes !== (sceneIds as string[]).length) throw new Error("One or more scenes are invalid for this project");
      await prisma.shootDayScene.createMany({
        data: (sceneIds as string[]).map((sceneId, i) => ({ shootDayId: day.id, sceneId, sortOrder: i }))
      });
    }
    await logAudit({ action: "create", entityType: "ShootDay", entityId: day.id, after: day, performedBy: user, projectId });
    return `Created shoot day ${date.toLocaleDateString()} (id: ${day.id}).`;
  },

  update_shoot_day: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.shootDay.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Shoot day not found");
    const data: Record<string, unknown> = {};
    if (p.date !== undefined) data.date = optDate(p, "date");
    if (optStr(p, "callTime") !== undefined) data.callTime = optStr(p, "callTime") ?? null;
    if (optStr(p, "status")) data.status = oneOf(optStr(p, "status")!, SHOOT_DAY_STATUSES, "status");
    if (optStr(p, "locationId") !== undefined) {
      const locationId = optStr(p, "locationId");
      if (locationId) {
        const location = await prisma.location.findFirst({ where: { id: locationId, projectId, isDeleted: false } });
        if (!location) throw new Error("Location not found");
      }
      data.locationId = locationId ?? null;
    }
    if (optStr(p, "notes") !== undefined) data.notes = optStr(p, "notes") ?? null;
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.shootDay.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "ShootDay", entityId: id, before, after, performedBy: user, projectId });
    return `Updated shoot day.`;
  },

  delete_shoot_day: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.shootDay.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Shoot day not found");
    await prisma.shootDay.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "ShootDay", entityId: id, performedBy: user, projectId });
    return `Deleted shoot day.`;
  },

  restore_shoot_day: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.shootDay.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Shoot day not found");
    await prisma.shootDay.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "ShootDay", entityId: id, performedBy: user, projectId });
    return `Restored shoot day.`;
  },

  assign_scenes_to_day: async (p, user, projectId) => {
    const shootDayId = requireStr(p, "shootDayId");
    const sceneIds = requireArr(p, "sceneIds");
    const day = await prisma.shootDay.findFirst({ where: { id: shootDayId, projectId } });
    if (!day) throw new Error("Shoot day not found");
    const sceneCount = await prisma.scene.count({
      where: { id: { in: sceneIds }, projectId, isDeleted: false }
    });
    if (sceneCount !== sceneIds.length) throw new Error("One or more scenes are invalid for this project");
    // Replace existing assignments
    await prisma.shootDayScene.deleteMany({ where: { shootDayId } });
    await prisma.shootDayScene.createMany({
      data: sceneIds.map((sceneId, i) => ({ shootDayId, sceneId, sortOrder: i }))
    });
    await logAudit({ action: "update", entityType: "ShootDay", entityId: shootDayId, changeNote: `Assigned ${sceneIds.length} scene(s)`, performedBy: user, projectId });
    return `Assigned ${sceneIds.length} scene(s) to shoot day.`;
  },

  assign_crew_to_day: async (p, user, projectId) => {
    const shootDayId = requireStr(p, "shootDayId");
    const crewMemberIds = requireArr(p, "crewMemberIds");
    const day = await prisma.shootDay.findFirst({ where: { id: shootDayId, projectId } });
    if (!day) throw new Error("Shoot day not found");
    const crewCount = await prisma.crewMember.count({
      where: { id: { in: crewMemberIds }, projectId, isDeleted: false }
    });
    if (crewCount !== crewMemberIds.length) throw new Error("One or more crew members are invalid for this project");
    // Replace existing assignments
    await prisma.shootDayCrew.deleteMany({ where: { shootDayId } });
    await prisma.shootDayCrew.createMany({
      data: crewMemberIds.map((crewMemberId) => ({ shootDayId, crewMemberId }))
    });
    await logAudit({ action: "update", entityType: "ShootDay", entityId: shootDayId, changeNote: `Assigned ${crewMemberIds.length} crew member(s)`, performedBy: user, projectId });
    return `Assigned ${crewMemberIds.length} crew member(s) to shoot day.`;
  },

  // ---- NOTES ----

  create_note: async (p, user, projectId) => {
    const title = requireStr(p, "title");
    const note = await prisma.note.create({
      data: {
        projectId,
        title,
        category: optStr(p, "category"),
        body: optStr(p, "body"),
      }
    });
    await logAudit({ action: "create", entityType: "Note", entityId: note.id, after: note, performedBy: user, projectId });
    return `Created note "${title}" (id: ${note.id}).`;
  },

  update_note: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.note.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Note not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "title")) data.title = optStr(p, "title");
    if (optStr(p, "category") !== undefined) data.category = optStr(p, "category") ?? null;
    if (optStr(p, "body") !== undefined) data.body = optStr(p, "body") ?? null;
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.note.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "Note", entityId: id, before, after, performedBy: user, projectId });
    return `Updated note "${after.title}".`;
  },

  delete_note: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.note.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Note not found");
    await prisma.note.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "Note", entityId: id, performedBy: user, projectId });
    return `Deleted note.`;
  },

  restore_note: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.note.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Note not found");
    await prisma.note.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "Note", entityId: id, performedBy: user, projectId });
    return `Restored note.`;
  },

  // ---- BUDGET ----

  update_total_budget: async (p, user, projectId) => {
    const amount = optNum(p, "amount");
    if (amount === undefined || amount < 0) throw new Error("amount must be a non-negative number");
    await prisma.projectSettings.upsert({
      where: { projectId },
      update: { totalBudget: amount },
      create: { projectId, totalBudget: amount },
    });
    await logAudit({ action: "update", entityType: "ProjectSettings", entityId: projectId, changeNote: `Set total budget to ${amount}`, performedBy: user, projectId });
    return `Updated total budget to ${amount}.`;
  },

  update_bucket_planned: async (p, user, projectId) => {
    const bucketId = requireStr(p, "bucketId");
    const amount = optNum(p, "amount");
    if (amount === undefined || amount < 0) throw new Error("amount must be a non-negative number");
    const bucket = await prisma.budgetBucket.findFirst({ where: { id: bucketId, projectId } });
    if (!bucket) throw new Error("Budget bucket not found");
    await prisma.budgetBucket.update({ where: { id: bucketId }, data: { plannedAmount: amount } });
    await logAudit({ action: "update", entityType: "BudgetBucket", entityId: bucketId, changeNote: `Set planned to ${amount}`, performedBy: user, projectId });
    return `Updated "${bucket.name}" planned amount to ${amount}.`;
  },

  create_line_item: async (p, user, projectId) => {
    const bucketId = requireStr(p, "bucketId");
    const description = requireStr(p, "description");
    const bucket = await prisma.budgetBucket.findFirst({ where: { id: bucketId, projectId } });
    if (!bucket) throw new Error("Budget bucket not found");
    const item = await prisma.budgetLineItem.create({
      data: {
        projectId,
        bucketId,
        description,
        plannedAmount: optNum(p, "plannedAmount") ?? 0,
        actualAmount: optNum(p, "actualAmount") ?? 0,
        date: optDate(p, "date"),
        notes: optStr(p, "notes"),
      }
    });
    await logAudit({ action: "create", entityType: "BudgetLineItem", entityId: item.id, after: item, performedBy: user, projectId });
    return `Created line item "${description}" (id: ${item.id}).`;
  },

  update_line_item: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const before = await prisma.budgetLineItem.findFirst({ where: { id, projectId } });
    if (!before || before.isDeleted) throw new Error("Line item not found");
    const data: Record<string, unknown> = {};
    if (optStr(p, "description")) data.description = optStr(p, "description");
    if (p.plannedAmount !== undefined) data.plannedAmount = optNum(p, "plannedAmount") ?? 0;
    if (p.actualAmount !== undefined) data.actualAmount = optNum(p, "actualAmount") ?? 0;
    if (p.date !== undefined) data.date = optDate(p, "date") ?? null;
    if (optStr(p, "notes") !== undefined) data.notes = optStr(p, "notes") ?? null;
    if (!Object.keys(data).length) throw new Error("No fields to update");
    const after = await prisma.budgetLineItem.update({ where: { id }, data });
    await logAudit({ action: "update", entityType: "BudgetLineItem", entityId: id, before, after, performedBy: user, projectId });
    return `Updated line item "${after.description}".`;
  },

  delete_line_item: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.budgetLineItem.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Line item not found");
    await prisma.budgetLineItem.update({ where: { id }, data: { isDeleted: true } });
    await logAudit({ action: "delete", entityType: "BudgetLineItem", entityId: id, performedBy: user, projectId });
    return `Deleted line item.`;
  },

  restore_line_item: async (p, user, projectId) => {
    const id = requireStr(p, "id");
    const existing = await prisma.budgetLineItem.findFirst({ where: { id, projectId } });
    if (!existing) throw new Error("Line item not found");
    await prisma.budgetLineItem.update({ where: { id }, data: { isDeleted: false } });
    await logAudit({ action: "restore", entityType: "BudgetLineItem", entityId: id, performedBy: user, projectId });
    return `Restored line item.`;
  },

  // ---- SETTINGS ----

  update_project_settings: async (p, user, projectId) => {
    const data: Record<string, unknown> = {};
    if (optStr(p, "projectName")) data.projectName = optStr(p, "projectName");
    if (p.totalBudget !== undefined) data.totalBudget = optNum(p, "totalBudget");
    if (optStr(p, "currencySymbol")) data.currencySymbol = optStr(p, "currencySymbol");
    if (!Object.keys(data).length) throw new Error("No fields to update");
    await prisma.projectSettings.upsert({
      where: { projectId },
      update: data,
      create: { projectId, ...data },
    });
    const parts: string[] = [];
    if (data.projectName) parts.push(`name → "${data.projectName}"`);
    if (data.totalBudget !== undefined) parts.push(`budget → ${data.totalBudget}`);
    if (data.currencySymbol) parts.push(`currency → "${data.currencySymbol}"`);
    await logAudit({ action: "update", entityType: "ProjectSettings", entityId: projectId, changeNote: parts.join(", "), performedBy: user, projectId });
    return `Updated project settings: ${parts.join(", ")}.`;
  },
};

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!isChatEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  const userId = await getSessionUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const performedBy = await getPerformedBy();
  const projectId = await getCurrentProjectId();
  if (!projectId) {
    return NextResponse.json({ error: "No project selected" }, { status: 400 });
  }

  let body: P;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actionName = body.action;
  if (typeof actionName !== "string") {
    return NextResponse.json({ error: "Missing action field" }, { status: 400 });
  }

  const handler = handlers[actionName];
  if (!handler) {
    return NextResponse.json({ error: `Unknown action: ${actionName}` }, { status: 400 });
  }

  const section = ACTION_SECTION_MAP[actionName];
  if (section) {
    try {
      await requireSectionAccess(section);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "You don't have access to this section." },
        { status: 403 }
      );
    }
  }

  try {
    const message = await handler(body, performedBy, projectId);
    // Revalidate the whole app so the UI reflects changes
    revalidatePath("/", "layout");
    return NextResponse.json({ message });
  } catch (err) {
    logger.error("Chat action failed", { action: actionName as string, error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 }
    );
  }
}
