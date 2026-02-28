import { createLogger } from "@/lib/logger";

const logger = createLogger("weather");

/**
 * Server-side only. Fetch lat/lng for an address using Google Places
 * Text Search. Returns null if not found or on error.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address?.trim()) return null;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logger.warn("GOOGLE_MAPS_API_KEY not set — geocodeAddress disabled", {
      action: "geocodeAddress",
      hint: "Set it in .env",
    });
    return null;
  }
  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.location"
        },
        body: JSON.stringify({
          textQuery: address.trim(),
          maxResultCount: 1
        })
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: Array<{ location?: { latitude?: number; longitude?: number } }>;
    };
    const first = data.places?.[0]?.location;
    if (!first || first.latitude == null || first.longitude == null) return null;
    return { lat: first.latitude, lng: first.longitude };
  } catch {
    return null;
  }
}
/** Format ISO time string (e.g. "2026-03-01T06:42") to 12-hour "6:42 AM" */
function formatTime12(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const h = d.getHours();
    const m = d.getMinutes();
    const am = h < 12;
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
  } catch {
    return "—";
  }
}

export interface WeatherData {
  summary: string;
  sunrise: string;
  sunset: string;
}

const WEATHER_UNAVAILABLE = "Weather unavailable — update closer to shoot date";

/**
 * Server-side only. Fetch weather summary and sunrise/sunset for a date at lat/lng.
 * Open-Meteo free API, max 16 days forecast.
 */
export async function fetchWeatherSummary(
  lat: number,
  lng: number,
  date: Date
): Promise<WeatherData> {
  const fallback: WeatherData = {
    summary: WEATHER_UNAVAILABLE,
    sunrise: "—",
    sunset: "—"
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const shootDate = new Date(date);
  shootDate.setHours(0, 0, 0, 0);
  const daysAhead = Math.round(
    (shootDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (daysAhead < 0 || daysAhead > 16) {
    return fallback;
  }
  try {
    const start = date.toISOString().slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&timezone=auto&start_date=${start}&end_date=${start}&temperature_unit=fahrenheit`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      daily?: {
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: (number | null)[];
        sunrise?: string[];
        sunset?: string[];
      };
    };
    const daily = data.daily;
    if (
      !daily?.temperature_2m_max?.length ||
      !daily.temperature_2m_min?.length
    ) {
      return fallback;
    }
    const high = Math.round(daily.temperature_2m_max[0]);
    const low = Math.round(daily.temperature_2m_min[0]);
    const pop = daily.precipitation_probability_max?.[0] ?? 0;
    const summary = `High ${high}°F / Low ${low}°F, ${pop}% chance of rain`;
    const sunrise = formatTime12(daily.sunrise?.[0]);
    const sunset = formatTime12(daily.sunset?.[0]);
    return { summary, sunrise, sunset };
  } catch {
    return fallback;
  }
}

/**
 * Server-side only. Find nearest emergency room using Google Places Text Search.
 * Takes latitude/longitude and returns "Name — Address" or a fallback message.
 */
export async function fetchNearestHospital(
  lat: number,
  lng: number
): Promise<string> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logger.warn("GOOGLE_MAPS_API_KEY not set — hospital lookup disabled", {
      action: "fetchNearestHospital",
      hint: "Set it in .env",
    });
    return "ER lookup failed — enter manually";
  }

  try {
    const res = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location"
        },
        body: JSON.stringify({
          textQuery: "emergency room",
          maxResultCount: 10,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 16093.4 // 10 miles in meters
            }
          }
        })
      }
    );

    if (!res.ok) {
      return "ER lookup failed — enter manually";
    }

    const data = (await res.json()) as {
      places?: Array<{
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }>;
    };

    // Filter to results that contain "emergency" in the name, pick closest
    const matches = (data.places ?? []).filter((p) => {
      const name = p.displayName?.text?.toLowerCase() ?? "";
      return name.includes("emergency");
    });

    // Sort by distance from the location
    matches.sort((a, b) => {
      const distA = Math.hypot(
        (a.location?.latitude ?? 0) - lat,
        (a.location?.longitude ?? 0) - lng
      );
      const distB = Math.hypot(
        (b.location?.latitude ?? 0) - lat,
        (b.location?.longitude ?? 0) - lng
      );
      return distA - distB;
    });

    const match = matches[0];
    if (!match) {
      return "No emergency room found nearby — enter manually";
    }

    const name = match.displayName?.text?.trim();
    const address = match.formattedAddress?.trim();
    if (!name && !address) {
      return "ER lookup failed — enter manually";
    }
    if (name && address) return `${name} — ${address}`;
    return name || address || "ER lookup failed — enter manually";
  } catch {
    return "ER lookup failed — enter manually";
  }
}
