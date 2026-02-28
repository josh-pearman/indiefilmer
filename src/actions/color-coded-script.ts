"use server";

import { prisma } from "@/lib/db";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  buildColorCodedScriptHtml,
  buildLocationToHex,
  type SceneForColorScript
} from "@/lib/color-coded-script";

export type ColorCodedScriptResult =
  | { ok: true; html: string; filename: string }
  | { ok: false; error: string };

/**
 * Numeric-aware sort for scene numbers (1, 2, 10, 2A, etc.).
 */
function compareSceneNumbers(a: string, b: string): number {
  const matchA = /^(\d+)(.*)$/.exec(a.trim());
  const matchB = /^(\d+)(.*)$/.exec(b.trim());
  const numA = matchA ? parseInt(matchA[1], 10) : 0;
  const numB = matchB ? parseInt(matchB[1], 10) : 0;
  if (numA !== numB) return numA - numB;
  const suffixA = matchA?.[2] ?? "";
  const suffixB = matchB?.[2] ?? "";
  return suffixA.localeCompare(suffixB, undefined, { sensitivity: "base" });
}

export async function getColorCodedScript(): Promise<ColorCodedScriptResult> {
  await requireSectionAccess("script");
  const projectId = await requireCurrentProjectId();
  const [scenes, settings, currentVersion] = await Promise.all([
    prisma.scene.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { sceneNumber: "asc" },
      include: { location: { select: { name: true } } }
    }),
    prisma.projectSettings.findUnique({
      where: { projectId },
      select: { projectName: true }
    }),
    prisma.scriptVersion.findFirst({
      where: { projectId, isCurrent: true, isDeleted: false },
      select: { versionName: true }
    })
  ]);

  const sorted = [...scenes].sort((a, b) =>
    compareSceneNumbers(a.sceneNumber, b.sceneNumber)
  );

  const sceneInputs: SceneForColorScript[] = sorted.map((s) => {
    const locName = s.location?.name ?? null;
    const intExt = s.intExt?.toUpperCase() || "INT";
    const dayNight = s.dayNight?.toUpperCase() || "DAY";
    const slugline = locName
      ? `${intExt}. ${locName.toUpperCase()} - ${dayNight}`
      : `${intExt}. — ${dayNight}`;
    return {
      sceneNumber: s.sceneNumber,
      locationName: locName,
      slugline,
      synopsis: s.synopsis ?? null
    };
  });

  const locationToHex = buildLocationToHex(sceneInputs);

  const projectName =
    settings?.projectName?.trim() || "Untitled Project";
  const versionLabel = currentVersion?.versionName?.trim();
  const title = versionLabel
    ? `${projectName} — ${versionLabel}`
    : projectName;
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const html = buildColorCodedScriptHtml({
    title,
    date,
    scenes: sceneInputs,
    locationToHex
  });

  const safeName = projectName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 80) || "script";
  const filename = `${safeName}-color-coded-${new Date().toISOString().slice(0, 10)}.html`;

  return { ok: true, html, filename };
}

/**
 * Returns the full HTML string for the color-coded script page (for serving as a route).
 */
export async function getColorCodedScriptHtml(): Promise<string> {
  const result = await getColorCodedScript();
  if (!result.ok) throw new Error(result.error);
  return result.html;
}
