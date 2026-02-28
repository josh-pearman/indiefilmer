"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { validateFileType, validateFileSize } from "@/lib/file-validation";
import { checkStorageQuota } from "@/lib/storage-quota";
import {
  createSceneSchema,
  updateSceneSchema,
  toggleSceneTagSchema,
  sceneCastSchema,
  importScenesAndCastSchema
} from "@/lib/validators";

import { type ActionResult } from "@/lib/action-result";

function getShotlistsDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "shotlists");
}

function sanitizeShotlistFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

function parseNum(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function createScene(formData: FormData): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const raw = {
    sceneNumber: formData.get("sceneNumber"),
    title: (formData.get("title") as string) || undefined,
    intExt: formData.get("intExt") || undefined,
    dayNight: formData.get("dayNight") || undefined,
    pageCount: parseNum(formData.get("pageCount")),
    synopsis: (formData.get("synopsis") as string) || undefined,
    locationId: formData.get("locationId") ?? undefined
  };
  if (raw.locationId === "") raw.locationId = "";

  const parsed = createSceneSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const scene = await prisma.scene.create({
    data: {
      projectId,
      sceneNumber: data.sceneNumber,
      title: data.title ?? null,
      intExt: data.intExt ?? null,
      dayNight: data.dayNight ?? null,
      pageCount: data.pageCount ?? null,
      synopsis: data.synopsis ?? null,
      locationId: data.locationId === "" ? null : (data.locationId ?? null)
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Scene",
    entityId: scene.id,
    after: scene,
    changeNote: `Scene ${scene.sceneNumber} created`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  if (scene.locationId) revalidatePath(`/production/locations/${scene.locationId}`);
  revalidatePath("/production/locations");
  revalidatePath("/");
  return {};
}

export async function updateScene(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.scene.findUnique({
    where: { id }
  });
  if (!before || before.projectId !== projectId) return { error: "Scene not found" };

  const raw = {
    id,
    sceneNumber: formData.get("sceneNumber"),
    title: (formData.get("title") as string | null) ?? undefined,
    intExt: (formData.get("intExt") as string | null) ?? undefined,
    dayNight: (formData.get("dayNight") as string | null) ?? undefined,
    pageCount: parseNum(formData.get("pageCount")),
    synopsis: (formData.get("synopsis") as string | null) ?? undefined,
    locationId: (formData.get("locationId") as string | null) ?? undefined
  };

  const parsed = updateSceneSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const updatePayload: Parameters<typeof prisma.scene.update>[0]["data"] = {};
  if (data.sceneNumber !== undefined) updatePayload.sceneNumber = data.sceneNumber;
  if (data.title !== undefined) updatePayload.title = data.title || null;
  if (data.intExt !== undefined) updatePayload.intExt = data.intExt || null;
  if (data.dayNight !== undefined) updatePayload.dayNight = data.dayNight || null;
  if (data.pageCount !== undefined) updatePayload.pageCount = data.pageCount;
  if (data.synopsis !== undefined) updatePayload.synopsis = data.synopsis || null;
  if (data.locationId !== undefined) updatePayload.locationId = data.locationId || null;

  const afterRecord = await prisma.scene.update({
    where: { id },
    data: updatePayload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Scene",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${id}`);
  revalidatePath("/production/locations");
  if (before.locationId) revalidatePath(`/production/locations/${before.locationId}`);
  if (afterRecord.locationId)
    revalidatePath(`/production/locations/${afterRecord.locationId}`);
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export async function deleteScene(id: string): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.scene.findUnique({
    where: { id },
    select: { id: true, projectId: true, locationId: true }
  });
  if (!before || before.projectId !== projectId) return { error: "Scene not found" };

  await prisma.scene.update({
    where: { id },
    data: { isDeleted: true }
  });

  // Clean up join rows so deleted scenes don't appear on shoot day schedules
  await prisma.shootDayScene.deleteMany({ where: { sceneId: id } });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "Scene",
    entityId: id,
    before,
    changeNote: "Scene soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath("/production/schedule");
  revalidatePath("/production/locations");
  if (before.locationId) revalidatePath(`/production/locations/${before.locationId}`);
  revalidatePath("/");
  return {};
}

export async function restoreScene(id: string): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.scene.findUnique({
    where: { id },
    select: { id: true, projectId: true, locationId: true }
  });
  if (!before || before.projectId !== projectId) return { error: "Scene not found" };

  const afterRecord = await prisma.scene.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "Scene",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Scene restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${id}`);
  revalidatePath("/production/schedule");
  revalidatePath("/production/locations");
  if (afterRecord.locationId)
    revalidatePath(`/production/locations/${afterRecord.locationId}`);
  revalidatePath("/");
  return {};
}

export async function toggleSceneTag(
  sceneId: string,
  tag: string
): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const parsed = toggleSceneTagSchema.safeParse({ sceneId, tag });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: { tags: true }
  });
  if (!scene || scene.projectId !== projectId) return { error: "Scene not found" };

  const existing = scene.tags.find((t) => t.tag === parsed.data.tag);

  if (existing) {
    await prisma.sceneTag.delete({ where: { id: existing.id } });
    await logAudit({
      projectId,
      action: "update",
      entityType: "Scene",
      entityId: sceneId,
      changeNote: `Removed tag: ${parsed.data.tag}`,
      performedBy: await getPerformedBy()
    });
  } else {
    await prisma.sceneTag.create({
      data: { sceneId, tag: parsed.data.tag }
    });
    await logAudit({
      projectId,
      action: "update",
      entityType: "Scene",
      entityId: sceneId,
      changeNote: `Added tag: ${parsed.data.tag}`,
      performedBy: await getPerformedBy()
    });
  }

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${sceneId}`);
  revalidatePath("/");
  return {};
}

export async function addSceneCast(
  sceneId: string,
  castMemberId: string
): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const parsed = sceneCastSchema.safeParse({ sceneId, castMemberId });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const [scene, castMember, existing] = await Promise.all([
    prisma.scene.findUnique({ where: { id: sceneId } }),
    prisma.castMember.findUnique({
      where: { id: castMemberId, isDeleted: false }
    }),
    prisma.sceneCast.findFirst({
      where: { sceneId, castMemberId }
    })
  ]);

  if (!scene || scene.projectId !== projectId) return { error: "Scene not found" };
  if (!castMember || castMember.projectId !== projectId) return { error: "Cast member not found" };
  if (existing) return {}; // already assigned

  await prisma.sceneCast.create({
    data: { sceneId, castMemberId }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Scene",
    entityId: sceneId,
    changeNote: `Added cast: ${castMember.name}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${sceneId}`);
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export async function removeSceneCast(
  sceneId: string,
  castMemberId: string
): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const parsed = sceneCastSchema.safeParse({ sceneId, castMemberId });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const link = await prisma.sceneCast.findFirst({
    where: { sceneId, castMemberId },
    include: { castMember: true, scene: true }
  });
  if (!link || link.scene.projectId !== projectId) return {};

  await prisma.sceneCast.delete({ where: { id: link.id } });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Scene",
    entityId: sceneId,
    changeNote: `Removed cast: ${link.castMember.name}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${sceneId}`);
  revalidatePath("/production/schedule");
  revalidatePath("/production/catering");
  revalidatePath("/");
  return {};
}

export type ImportScenesResult = {
  success: boolean;
  sceneCount?: number;
  castCount?: number;
  locationCount?: number;
  skippedCharacterRefs?: number;
  skippedLocationRefs?: number;
  errors?: string[];
};

function stripMarkdownFences(str: string): string {
  let s = str.trim();
  const codeBlock = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const m = s.match(codeBlock);
  if (m) return m[1].trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[^\n]*\n?/, "").replace(/\n?```\s*$/, "");
    return s.trim();
  }
  return s;
}

function extractJsonObject(str: string): string | null {
  const trimmed = str.trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === "{") depth++;
    else if (trimmed[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  return trimmed.slice(start, end + 1);
}

export async function importScenesAndCast(
  jsonString: string
): Promise<ImportScenesResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  let raw = jsonString.trim();
  raw = stripMarkdownFences(raw);

  if (raw.startsWith("[")) {
    return {
      success: false,
      errors: [
        "Expected a JSON object with 'locations', 'cast', and 'scenes' keys. Make sure you used the latest extraction prompt."
      ]
    };
  }

  const jsonStr = raw.startsWith("{") ? raw : extractJsonObject(raw);
  if (!jsonStr) {
    return {
      success: false,
      errors: [
        "Invalid JSON. Make sure you copied the complete output from the LLM."
      ]
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return {
      success: false,
      errors: [
        "Invalid JSON. Make sure you copied the complete output from the LLM."
      ]
    };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      success: false,
      errors: ["Expected a JSON object."]
    };
  }

  const obj = parsed as Record<string, unknown>;
  if (!("locations" in obj)) {
    return { success: false, errors: ["Missing 'locations' key."] };
  }
  if (!("cast" in obj)) {
    return { success: false, errors: ["Missing 'cast' key."] };
  }
  if (!("scenes" in obj)) {
    return { success: false, errors: ["Missing 'scenes' key."] };
  }

  const validated = importScenesAndCastSchema.safeParse(parsed);
  if (!validated.success) {
    const errors: string[] = [];
    for (const issue of validated.error.issues) {
      const pathSegs = issue.path;
      if (pathSegs[0] === "locations" && typeof pathSegs[1] === "number") {
        errors.push(`Location at index ${pathSegs[1]}: ${issue.message}`);
      } else if (pathSegs[0] === "cast" && typeof pathSegs[1] === "number") {
        errors.push(`Cast member at index ${pathSegs[1]}: ${issue.message}`);
      } else if (pathSegs[0] === "scenes" && typeof pathSegs[1] === "number") {
        const idx = pathSegs[1];
        const sceneNum =
          typeof obj.scenes === "object" &&
          Array.isArray(obj.scenes) &&
          obj.scenes[idx] &&
          typeof (obj.scenes[idx] as { sceneNumber?: string }).sceneNumber === "string"
            ? (obj.scenes[idx] as { sceneNumber: string }).sceneNumber
            : idx;
        errors.push(`Scene at index ${idx} (scene '${sceneNum}'): ${issue.message}`);
      } else {
        errors.push(`${pathSegs.join(".")}: ${issue.message}`);
      }
    }
    return { success: false, errors };
  }

  const { locations, cast, scenes } = validated.data;
  if (locations.length === 0) {
    return { success: false, errors: ["No locations found."] };
  }
  if (cast.length === 0) {
    return { success: false, errors: ["No cast members found."] };
  }
  if (scenes.length === 0) {
    return { success: false, errors: ["No scenes found."] };
  }

  let skippedLocationRefs = 0;
  let skippedCharacterRefs = 0;

  await prisma.$transaction(async (tx) => {
    const locationNameToId = new Map<string, string>();
    for (const loc of locations) {
      const created = await tx.location.create({
        data: {
          projectId,
          name: loc.locationName,
          status: "Shortlist"
        }
      });
      locationNameToId.set(loc.locationName, created.id);
    }

    const characterNameToId = new Map<string, string>();
    for (const c of cast) {
      const created = await tx.castMember.create({
        data: {
          projectId,
          name: c.characterName,
          roleName: c.roleName ?? null,
          status: "TBD"
        }
      });
      characterNameToId.set(c.characterName, created.id);
    }

    for (const scene of scenes) {
      const locationId = scene.locationName
        ? locationNameToId.get(scene.locationName) ?? null
        : null;
      if (scene.locationName && !locationId) skippedLocationRefs++;

      const sceneRecord = await tx.scene.create({
        data: {
          projectId,
          sceneNumber: scene.sceneNumber,
          title: scene.title ?? null,
          intExt: scene.intExt ?? null,
          dayNight: scene.dayNight ?? null,
          pageCount: scene.pageCount ?? null,
          synopsis: scene.synopsis ?? null,
          locationId
        }
      });

      for (const tag of scene.tags) {
        await tx.sceneTag.create({
          data: { sceneId: sceneRecord.id, tag }
        });
      }

      for (const charName of scene.characters) {
        const castId = characterNameToId.get(charName);
        if (!castId) {
          skippedCharacterRefs++;
          continue;
        }
        await tx.sceneCast.create({
          data: { sceneId: sceneRecord.id, castMemberId: castId }
        });
      }
    }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Location",
    entityId: "bulk-import",
    changeNote: `Bulk imported ${locations.length} locations from script extraction`,
    performedBy: await getPerformedBy()
  });
  await logAudit({
    projectId,
    action: "create",
    entityType: "CastMember",
    entityId: "bulk-import",
    changeNote: `Bulk imported ${cast.length} cast members from script extraction`,
    performedBy: await getPerformedBy()
  });
  await logAudit({
    projectId,
    action: "create",
    entityType: "Scene",
    entityId: "bulk-import",
    changeNote: `Bulk imported ${scenes.length} scenes with cast and location assignments from script extraction`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath("/talent/cast");
  revalidatePath("/production/locations");
  revalidatePath("/");

  return {
    success: true,
    sceneCount: scenes.length,
    castCount: cast.length,
    locationCount: locations.length,
    skippedCharacterRefs,
    skippedLocationRefs
  };
}

export async function uploadShotlist(
  sceneId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId }
  });
  if (!scene || scene.projectId !== projectId) return { error: "Scene not found" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "No file provided" };

  const validation = validateFileType(file, "general");
  if (!validation.valid) return { error: validation.error };

  const sizeValidation = validateFileSize(file, "general");
  if (!sizeValidation.valid) return { error: sizeValidation.error };

  const quotaCheck = await checkStorageQuota(projectId, file.size);
  if (!quotaCheck.allowed) return { error: quotaCheck.error };

  const shotlistsDir = getShotlistsDir(projectId);
  await mkdir(shotlistsDir, { recursive: true });

  const baseName = file.name ? path.basename(file.name) : "file";
  const safeName = sanitizeShotlistFilename(baseName);
  const filename = `${sceneId}-${safeName}`;
  const filePath = path.join(shotlistsDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const before = scene.shotlistPath;
  if (before) {
    const oldPath = path.join(shotlistsDir, before);
    try {
      await unlink(oldPath);
    } catch {
      // ignore if already missing
    }
  }

  await prisma.scene.update({
    where: { id: sceneId },
    data: { shotlistPath: filename }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Scene",
    entityId: sceneId,
    changeNote: `Shotlist uploaded: ${filename}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${sceneId}`);
  return {};
}

export async function removeShotlist(sceneId: string): Promise<ActionResult> {
  await requireSectionAccess("scenes");
  const projectId = await requireCurrentProjectId();
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId }
  });
  if (!scene || scene.projectId !== projectId) return { error: "Scene not found" };
  if (!scene.shotlistPath) return { error: "No shotlist attached" };

  const filePath = path.join(getShotlistsDir(projectId), scene.shotlistPath);
  try {
    await unlink(filePath);
  } catch {
    // continue to clear DB even if file missing
  }

  await prisma.scene.update({
    where: { id: sceneId },
    data: { shotlistPath: null }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Scene",
    entityId: sceneId,
    changeNote: "Shotlist removed",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/script/scenes");
  revalidatePath(`/script/scenes/${sceneId}`);
  return {};
}
