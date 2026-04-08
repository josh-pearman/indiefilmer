import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateShotlist, getShotlistGenerationMode } from "@/lib/shotlist-generate";

export const maxDuration = 300; // 5 minutes (for Vercel/serverless, though we self-host)

export async function POST(request: NextRequest) {
  const mode = getShotlistGenerationMode();
  if (mode === "off") {
    return NextResponse.json(
      { error: "Auto-generation not available (CHAT_MODE is off)" },
      { status: 404 }
    );
  }

  const userId = await getSessionUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt;
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  const result = await generateShotlist(prompt, request.signal);

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ text: result.text });
}
