import { NextResponse } from "next/server";
import { getColorCodedScriptHtml } from "@/actions/color-coded-script";
import { createLogger } from "@/lib/logger";

const logger = createLogger("script-color-coded");

export async function GET() {
  try {
    const html = await getColorCodedScriptHtml();
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (err) {
    logger.error("Failed to generate color-coded script", {
      action: "GET",
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to generate color-coded script" },
      { status: 500 }
    );
  }
}
