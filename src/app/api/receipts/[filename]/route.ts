import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getCurrentProjectId } from "@/lib/project";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf"
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
  const baseDir = path.resolve(process.cwd(), "data/uploads", projectId, "receipts");
  const resolvedPath = path.resolve(baseDir, filename);
  if (!resolvedPath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const row = await prisma.budgetLineItem.findFirst({
    where: { receiptPath: filename, projectId },
    select: { id: true }
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "data/uploads", projectId, "receipts", filename);
  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  } catch (err) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
