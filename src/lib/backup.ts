import fs from "fs";
import path from "path";
import archiver from "archiver";
import { prisma } from "./db";

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Export a single project's data as a zip containing:
 * - project.json: all database rows for this project
 * - uploads/: all uploaded files for this project
 *
 * Backups are stored at data/backups/{projectId}/backup-{timestamp}.zip
 */
export async function createProjectBackup(projectId: string): Promise<string> {
  const projectRoot = process.cwd();
  const backupsDir = path.resolve(projectRoot, "data", "backups", projectId);
  const uploadsDir = path.resolve(projectRoot, "data", "uploads", projectId);

  ensureDir(backupsDir);

  const timestamp = formatTimestamp(new Date());
  const backupPath = path.join(backupsDir, `backup-${timestamp}.zip`);

  // Export all project data from the database
  const projectData = await exportProjectData(projectId);

  const output = fs.createWriteStream(backupPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  const archivePromise = new Promise<string>((resolve, reject) => {
    output.on("close", () => resolve(backupPath));
    output.on("error", (err) => reject(err));
  });

  archive.pipe(output);

  // Add project data as JSON
  archive.append(JSON.stringify(projectData, null, 2), { name: "project.json" });

  // Add uploaded files (if directory exists)
  if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, "uploads");
  }

  await archive.finalize();

  return archivePromise;
}

/**
 * Export all database rows for a project as a structured object.
 */
async function exportProjectData(projectId: string) {
  const [
    project,
    settings,
    members,
    invites,
    scriptVersions,
    castMembers,
    crewMembers,
    scenes,
    sceneTags,
    sceneCast,
    locations,
    locationFiles,
    locationVenues,
    shootDays,
    shootDayScenes,
    shootDayCrew,
    shootDayMeals,
    callSheets,
    callSheetCrew,
    cateringDays,
    cateringDayMeals,
    gearModels,
    gearItems,
    gearItemDays,
    budgetBuckets,
    budgetLineItems,
    notes,
    noteFiles,
    noteLinks,
    tasks,
    taskFiles,
    taskLinks,
    vaultFiles,
    auditLog,
  ] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.projectSettings.findUnique({ where: { projectId } }),
    prisma.projectMember.findMany({ where: { projectId } }),
    prisma.invite.findMany({ where: { projectId } }),
    prisma.scriptVersion.findMany({ where: { projectId } }),
    prisma.castMember.findMany({ where: { projectId } }),
    prisma.crewMember.findMany({ where: { projectId } }),
    prisma.scene.findMany({ where: { projectId } }),
    prisma.sceneTag.findMany({ where: { scene: { projectId } } }),
    prisma.sceneCast.findMany({ where: { scene: { projectId } } }),
    prisma.location.findMany({ where: { projectId } }),
    prisma.locationFile.findMany({ where: { location: { projectId } } }),
    prisma.locationVenue.findMany({ where: { location: { projectId } } }),
    prisma.shootDay.findMany({ where: { projectId } }),
    prisma.shootDayScene.findMany({ where: { shootDay: { projectId } } }),
    prisma.shootDayCrew.findMany({ where: { shootDay: { projectId } } }),
    prisma.shootDayMeal.findMany({ where: { shootDay: { projectId } } }),
    prisma.callSheet.findMany({ where: { shootDay: { projectId } } }),
    prisma.callSheetCrew.findMany({ where: { callSheet: { shootDay: { projectId } } } }),
    prisma.cateringDay.findMany({ where: { projectId } }),
    prisma.cateringDayMeal.findMany({ where: { cateringDay: { projectId } } }),
    prisma.gearModel.findMany({ where: { projectId } }),
    prisma.gearItem.findMany({ where: { gearModel: { projectId } } }),
    prisma.gearItemDay.findMany({ where: { gearItem: { gearModel: { projectId } } } }),
    prisma.budgetBucket.findMany({ where: { projectId } }),
    prisma.budgetLineItem.findMany({ where: { projectId } }),
    prisma.note.findMany({ where: { projectId } }),
    prisma.noteFile.findMany({ where: { note: { projectId } } }),
    prisma.noteLink.findMany({ where: { note: { projectId } } }),
    prisma.task.findMany({ where: { projectId } }),
    prisma.taskFile.findMany({ where: { task: { projectId } } }),
    prisma.taskLink.findMany({ where: { task: { projectId } } }),
    prisma.vaultFile.findMany({ where: { projectId } }),
    prisma.auditLog.findMany({ where: { projectId } }),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    settings,
    members,
    invites,
    scriptVersions,
    castMembers,
    crewMembers,
    scenes,
    sceneTags,
    sceneCast,
    locations,
    locationFiles,
    locationVenues,
    shootDays,
    shootDayScenes,
    shootDayCrew,
    shootDayMeals,
    callSheets,
    callSheetCrew,
    cateringDays,
    cateringDayMeals,
    gearModels,
    gearItems,
    gearItemDays,
    budgetBuckets,
    budgetLineItems,
    notes,
    noteFiles,
    noteLinks,
    tasks,
    taskFiles,
    taskLinks,
    vaultFiles,
    auditLog,
  };
}
