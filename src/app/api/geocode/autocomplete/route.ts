import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("geocode-autocomplete");

const PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get("text")?.trim() ?? "";

  if (text.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      logger.warn("GOOGLE_MAPS_API_KEY not set — address autocomplete disabled", {
        action: "GET",
      });
    }
    return NextResponse.json({ results: [] });
  }

  try {
    const res = await fetch(PLACES_TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location"
      },
      body: JSON.stringify({
        textQuery: text,
        maxResultCount: 5
      })
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json() as {
      places?: Array<{
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };

    const results =
      data.places?.map((p) => ({
        formatted: p.formattedAddress ??
          p.displayName?.text ??
          "",
        lat: p.location?.latitude ?? null,
        lon: p.location?.longitude ?? null
      })) ?? [];

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
