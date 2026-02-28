import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentProjectId } from "@/lib/project";
import { getOrCreateCallSheet } from "@/actions/call-sheet";
import { CallSheetPdfError, generateCallSheetPdf } from "@/lib/call-sheet-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawCallSheetId } = await context.params;
  const projectId = await getCurrentProjectId();
  if (!projectId) {
    return new Response("No project selected", { status: 400 });
  }

  const callSheet = await prisma.callSheet.findUnique({
    where: { id: rawCallSheetId },
    include: { shootDay: { select: { id: true, projectId: true } } }
  });

  if (!callSheet) {
    return new Response("Call sheet not found", { status: 404 });
  }
  if (callSheet.shootDay.projectId !== projectId) {
    return new Response("Forbidden", { status: 403 });
  }

  const initializedCallSheet =
    (await getOrCreateCallSheet(callSheet.shootDay.id)) ??
    (await prisma.callSheet.findUnique({ where: { id: rawCallSheetId } }));

  if (!initializedCallSheet) {
    return new Response("Call sheet not found", { status: 404 });
  }

  try {
    const { filename, pdfBuffer } = await generateCallSheetPdf(
      initializedCallSheet.id,
      projectId
    );

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  } catch (error) {
    if (error instanceof CallSheetPdfError) {
      return new Response(error.message, { status: error.status });
    }
    throw error;
  }
}
