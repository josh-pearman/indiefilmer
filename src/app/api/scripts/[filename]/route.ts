import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCurrentProjectId } from "@/lib/project";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".fdx": "application/xml",
  ".fountain": "text/plain",
  ".txt": "text/plain",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

export async function GET(
  request: Request,
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
  const baseDir = path.resolve(process.cwd(), "data/uploads", projectId, "scripts");
  const resolvedPath = path.resolve(baseDir, filename);
  if (!resolvedPath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const script = await prisma.scriptVersion.findFirst({
    where: { filePath: filename, projectId, isDeleted: false },
    select: { id: true }
  });
  if (!script) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "data/uploads", projectId, "scripts", filename);
  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1" && ext === ".pdf";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": inline
          ? `inline; filename="${filename}"`
          : `attachment; filename="${filename}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
