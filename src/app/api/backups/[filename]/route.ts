import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_NAME } from "@/lib/auth";
import { PROJECT_COOKIE_NAME } from "@/lib/project";

const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  // Authenticate: require a valid session
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { id: sessionId },
    select: { id: true }
  });
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authorize: require an active project and admin role
  const projectId = cookieStore.get(PROJECT_COOKIE_NAME)?.value;
  if (!projectId) {
    return NextResponse.json({ error: "No project selected" }, { status: 403 });
  }
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
    select: { role: true }
  });
  if (!member || member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Validate filename
  const { filename } = await params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const baseDir = path.resolve(BACKUPS_DIR, projectId);
  const resolvedPath = path.resolve(baseDir, filename);
  if (!resolvedPath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  if (!filename.endsWith(".zip")) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // Serve from project-scoped backup directory
  const filePath = path.join(BACKUPS_DIR, projectId, filename);
  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
