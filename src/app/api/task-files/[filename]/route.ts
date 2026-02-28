import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCurrentProjectId } from "@/lib/project";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".txt": "text/plain",
  ".md": "text/markdown"
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const userId = await getSessionUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  const projectId = await getCurrentProjectId();
  if (!projectId) {
    return NextResponse.json({ error: "No project selected" }, { status: 400 });
  }
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const baseDir = path.resolve(process.cwd(), "data/uploads", projectId, "tasks");
  const resolvedPath = path.resolve(baseDir, filename);
  if (!resolvedPath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const fileRow = await prisma.taskFile.findFirst({
    where: { filePath: filename, task: { projectId } },
    select: { id: true }
  });
  if (!fileRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "data/uploads", projectId, "tasks", filename);
  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
