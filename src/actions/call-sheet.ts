"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import {
  sendCallSheetEmailsSchema,
  updateCallSheetCrewSchema,
  updateCallSheetSchema
} from "@/lib/validators";
import type { CallSheet } from "@prisma/client";
import {
  geocodeAddress,
  fetchWeatherSummary,
  fetchNearestHospital
} from "@/lib/weather";
import { createLogger } from "@/lib/logger";
import { isEmailEnabled, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { generateCallSheetPdf } from "@/lib/call-sheet-pdf";

const logger = createLogger("call-sheet");

function buildStaticMapUrl(lat: number, lng: number): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    logger.warn("GOOGLE_MAPS_API_KEY not set — static map URL will not be generated", {
      action: "buildStaticMapUrl",
    });
    return null;
  }
  const base = "https://maps.googleapis.com/maps/api/staticmap";
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: "14",
    size: "600x300",
    maptype: "roadmap",
    markers: `color:red|${lat},${lng}`,
    key
  });
  return `${base}?${params.toString()}`;
}

export async function getOrCreateCallSheet(
  shootDayId: string
): Promise<CallSheet | null> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const shootDay = await prisma.shootDay.findUnique({
    where: { id: shootDayId, isDeleted: false },
    include: {
      location: true,
      scenes: {
        orderBy: { sortOrder: "asc" },
        include: {
          scene: {
            include: {
              castAssignments: { include: { castMember: true } }
            }
          }
        }
      }
    }
  });
  if (!shootDay || shootDay.projectId !== projectId) return null;

  let callSheet = await prisma.callSheet.findUnique({
    where: { shootDayId }
  });
  if (callSheet && callSheet.personalCallTimes === null) {
    // Skeleton record created eagerly by createShootDay — delete it so the
    // full init path below runs and populates crew, call times, weather, etc.
    await prisma.callSheet.delete({ where: { id: callSheet.id } });
    callSheet = null;
  }
  if (callSheet) {
    // Auto-refresh weather/map when data is missing or the location has changed.
    const loc = shootDay.location;
    let coords: { lat: number; lng: number } | null = null;
    if (loc?.latitude != null && loc?.longitude != null) {
      coords = { lat: loc.latitude, lng: loc.longitude };
    } else if (loc?.address?.trim()) {
      coords = await geocodeAddress(loc.address);
    }

    const missingData =
      !callSheet.mapImageUrl ||
      !callSheet.weatherSummary ||
      callSheet.weatherSummary.includes("unavailable");

    // Check if the location has changed by comparing coords in the existing map URL
    const locationChanged = coords && callSheet.mapImageUrl
      ? !callSheet.mapImageUrl.includes(`${coords.lat}`) ||
        !callSheet.mapImageUrl.includes(`${coords.lng}`)
      : false;

    if (coords && (missingData || locationChanged)) {
      const weatherData = await fetchWeatherSummary(coords.lat, coords.lng, shootDay.date);
      const mapUrl = buildStaticMapUrl(coords.lat, coords.lng);
      callSheet = await prisma.callSheet.update({
        where: { id: callSheet.id },
        data: {
          weatherSummary: weatherData.summary,
          sunrise: weatherData.sunrise,
          sunset: weatherData.sunset,
          mapImageUrl: mapUrl ?? undefined
        }
      });
    }
    return callSheet;
  }

  // Personal call times: cast only (from day's scenes). Crew is in CallSheetCrew.
  const castIds = new Set<string>();
  for (const sds of shootDay.scenes) {
    // Safety net: skip cast assignments where the cast member has been soft-deleted
    sds.scene.castAssignments
      ?.filter((a) => !a.castMember.isDeleted)
      .forEach((a) => castIds.add(a.castMemberId));
  }
  const castMembers = await prisma.castMember.findMany({
    where: { id: { in: Array.from(castIds) }, projectId, isDeleted: false }
  });
  const crewMembers = await prisma.crewMember.findMany({
    where: { projectId, isDeleted: false }
  });

  function buildContact(
    phone: string | null,
    email: string | null,
    includePhone: boolean,
    includeEmail: boolean
  ): string {
    const parts: string[] = [];
    if (includeEmail && email?.trim()) parts.push(email.trim());
    if (includePhone && phone?.trim()) parts.push(phone.trim());
    return parts.length ? parts.join(", ") : "—";
  }

  const personalCallTimesArr: Array<{
    name: string;
    role: string;
    characterName?: string;
    type: string;
    callTime: string;
    contact: string;
  }> = [];
  castMembers.forEach((c) => {
    const characterName = c.name;
    personalCallTimesArr.push({
      // Name column: actor name if present, otherwise character name
      name: c.actorName?.trim() || characterName,
      role: characterName?.toUpperCase() ?? "—",
      characterName,
      type: "cast",
      callTime: "",
      contact: buildContact(
        c.phone,
        c.email,
        c.includePhoneOnCallSheet,
        c.includeEmailOnCallSheet
      )
    });
  });
  const personalCallTimes = JSON.stringify(personalCallTimesArr);

  let weatherSummary = "Weather unavailable — update closer to shoot date";
  let sunrise: string | null = null;
  let sunset: string | null = null;
  let mapImageUrl: string | null = null;
  const loc = shootDay.location;
  const hasStoredCoords =
    loc &&
    loc.latitude != null &&
    loc.longitude != null &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude);

  if (hasStoredCoords) {
    const weatherData = await fetchWeatherSummary(
      loc!.latitude!,
      loc!.longitude!,
      shootDay.date
    );
    weatherSummary = weatherData.summary;
    sunrise = weatherData.sunrise;
    sunset = weatherData.sunset;
    const url = buildStaticMapUrl(loc!.latitude!, loc!.longitude!);
    if (url) mapImageUrl = url;
  } else if (loc?.address?.trim()) {
    const coords = await geocodeAddress(loc.address);
    if (coords) {
      const weatherData = await fetchWeatherSummary(
        coords.lat,
        coords.lng,
        shootDay.date
      );
      weatherSummary = weatherData.summary;
      sunrise = weatherData.sunrise;
      sunset = weatherData.sunset;
      const url = buildStaticMapUrl(coords.lat, coords.lng);
      if (url) mapImageUrl = url;
    }
  } else {
    weatherSummary = "Add an address to the location for weather";
  }

  try {
    callSheet = await prisma.callSheet.create({
      data: {
        shootDayId,
        generalCallTime: shootDay.callTime ?? undefined,
        weatherSummary,
        sunrise,
        sunset,
        mapImageUrl: mapImageUrl ?? undefined,
        personalCallTimes
      }
    });
  } catch (e: unknown) {
    // Another concurrent request already created the full record — use it.
    if ((e as { code?: string }).code === "P2002") {
      callSheet = await prisma.callSheet.findUnique({ where: { shootDayId } });
      if (callSheet) return callSheet;
    }
    throw e;
  }

  // Include all active crew on the call sheet by default
  if (crewMembers.length > 0) {
    await prisma.callSheetCrew.createMany({
      data: crewMembers.map((c) => ({
        callSheetId: callSheet!.id,
        crewId: c.id
      }))
    });
  }

  await logAudit({
    projectId,
    action: "create",
    entityType: "CallSheet",
    entityId: callSheet.id,
    after: callSheet,
    changeNote: `Call sheet created for shoot day ${shootDay.date.toISOString().slice(0, 10)}`,
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${shootDayId}/call-sheet`);
  return callSheet;
}

export async function updateCallSheet(
  id: string,
  data: {
    generalCallTime?: string;
    announcements?: string;
    weatherSummary?: string;
    sunrise?: string;
    sunset?: string;
    nearestHospital?: string;
    emergencyContact?: string;
    personalCallTimes?: string;
  }
): Promise<{ error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const parsed = updateCallSheetSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const before = await prisma.callSheet.findUnique({
    where: { id },
    include: { shootDay: { select: { projectId: true } } }
  });
  if (!before || before.shootDay.projectId !== projectId) return { error: "Call sheet not found" };

  const updatePayload: Parameters<typeof prisma.callSheet.update>[0]["data"] =
    {};
  if (parsed.data.generalCallTime !== undefined)
    updatePayload.generalCallTime = parsed.data.generalCallTime;
  if (parsed.data.announcements !== undefined)
    updatePayload.announcements = parsed.data.announcements;
  if (parsed.data.weatherSummary !== undefined)
    updatePayload.weatherSummary = parsed.data.weatherSummary;
  if (parsed.data.sunrise !== undefined)
    updatePayload.sunrise = parsed.data.sunrise ?? null;
  if (parsed.data.sunset !== undefined)
    updatePayload.sunset = parsed.data.sunset ?? null;
  if (parsed.data.nearestHospital !== undefined)
    updatePayload.nearestHospital = parsed.data.nearestHospital;
  if (parsed.data.emergencyContact !== undefined)
    updatePayload.emergencyContact = parsed.data.emergencyContact;
  if (parsed.data.personalCallTimes !== undefined)
    updatePayload.personalCallTimes = parsed.data.personalCallTimes;

  const afterRecord = await prisma.callSheet.update({
    where: { id },
    data: updatePayload
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "CallSheet",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${before.shootDayId}/call-sheet`);
  return {};
}

export type RefreshCallSheetDataResult = {
  weatherSummary?: string;
  sunrise?: string;
  sunset?: string;
  nearestHospital?: string;
  mapImageUrl?: string | null;
  error?: string;
};

export async function refreshCallSheetData(
  callSheetId: string
): Promise<RefreshCallSheetDataResult> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const callSheet = await prisma.callSheet.findUnique({
    where: { id: callSheetId },
    include: { shootDay: { include: { location: true } } }
  });
  if (!callSheet || callSheet.shootDay.projectId !== projectId)
    return { error: "Call sheet not found" };

  const loc = callSheet.shootDay.location;
  const hasStoredCoords =
    loc &&
    loc.latitude != null &&
    loc.longitude != null &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude);

  let coords: { lat: number; lng: number } | null = null;
  if (hasStoredCoords) {
    coords = { lat: loc!.latitude!, lng: loc!.longitude! };
  } else if (loc?.address?.trim()) {
    coords = await geocodeAddress(loc.address);
  }

  if (!coords) {
    return {
      error: loc?.address?.trim()
        ? "Weather unavailable — could not geocode address"
        : "Weather unavailable — add location address and try again"
    };
  }

  const weatherData = await fetchWeatherSummary(
    coords.lat,
    coords.lng,
    callSheet.shootDay.date
  );
  const mapImageUrl = buildStaticMapUrl(coords.lat, coords.lng);

  await prisma.callSheet.update({
    where: { id: callSheetId },
    data: {
      weatherSummary: weatherData.summary,
      sunrise: weatherData.sunrise,
      sunset: weatherData.sunset,
      mapImageUrl: mapImageUrl ?? undefined
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "CallSheet",
    entityId: callSheetId,
    changeNote: "Call sheet weather/map refreshed",
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${callSheet.shootDayId}/call-sheet`);
  return {
    weatherSummary: weatherData.summary,
    sunrise: weatherData.sunrise,
    sunset: weatherData.sunset,
    mapImageUrl: mapImageUrl ?? null
  };
}

export async function findNearestER(
  callSheetId: string
): Promise<{ nearestHospital?: string; error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const callSheet = await prisma.callSheet.findUnique({
    where: { id: callSheetId },
    include: { shootDay: { include: { location: true } } }
  });
  if (!callSheet || callSheet.shootDay.projectId !== projectId) return { error: "Call sheet not found" };

  const loc = callSheet.shootDay.location;
  let coords: { lat: number; lng: number } | null = null;
  if (loc?.latitude != null && loc?.longitude != null) {
    coords = { lat: loc.latitude, lng: loc.longitude };
  } else if (loc?.address?.trim()) {
    coords = await geocodeAddress(loc.address);
  }

  if (!coords) {
    return { error: "Could not determine location coordinates" };
  }

  const nearestHospital = await fetchNearestHospital(coords.lat, coords.lng);

  await prisma.callSheet.update({
    where: { id: callSheetId },
    data: { nearestHospital }
  });

  revalidatePath(`/production/schedule/${callSheet.shootDayId}/call-sheet`);
  return { nearestHospital };
}

export type UpdateLocationAddressResult = {
  address: string;
  weatherSummary?: string;
  sunrise?: string;
  sunset?: string;
  mapImageUrl?: string | null;
  nearestHospital?: string;
  error?: string;
};

export async function updateLocationAddress(
  callSheetId: string,
  newAddress: string
): Promise<UpdateLocationAddressResult> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const callSheet = await prisma.callSheet.findUnique({
    where: { id: callSheetId },
    include: { shootDay: { include: { location: true } } }
  });
  if (!callSheet || callSheet.shootDay.projectId !== projectId) return { address: newAddress, error: "Call sheet not found" };

  const loc = callSheet.shootDay.location;
  if (!loc) return { address: newAddress, error: "No location linked to this shoot day" };

  const trimmed = newAddress.trim();
  if (!trimmed) return { address: "", error: "Address cannot be empty" };

  // Geocode the new address
  const coords = await geocodeAddress(trimmed);
  if (!coords) {
    return { address: trimmed, error: "Could not geocode address — check the address and try again" };
  }

  // Update the Location record (persists to locations page too)
  await prisma.location.update({
    where: { id: loc.id },
    data: {
      address: trimmed,
      latitude: coords.lat,
      longitude: coords.lng
    }
  });

  // Re-fetch weather and rebuild map
  const weatherData = await fetchWeatherSummary(coords.lat, coords.lng, callSheet.shootDay.date);
  const mapImageUrl = buildStaticMapUrl(coords.lat, coords.lng);

  // Find nearest ER for the new location
  const nearestHospital = await fetchNearestHospital(coords.lat, coords.lng);

  await prisma.callSheet.update({
    where: { id: callSheetId },
    data: {
      weatherSummary: weatherData.summary,
      sunrise: weatherData.sunrise,
      sunset: weatherData.sunset,
      mapImageUrl: mapImageUrl ?? undefined,
      nearestHospital: nearestHospital ?? undefined
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: loc.id,
    changeNote: `Location address updated to "${trimmed}" from call sheet`,
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${callSheet.shootDayId}/call-sheet`);
  revalidatePath("/production/locations");

  return {
    address: trimmed,
    weatherSummary: weatherData.summary,
    sunrise: weatherData.sunrise,
    sunset: weatherData.sunset,
    mapImageUrl: mapImageUrl ?? null,
    nearestHospital: nearestHospital ?? undefined
  };
}

/** Kept for backwards compatibility; calls refreshCallSheetData. */
export async function refreshWeather(
  callSheetId: string
): Promise<{ weatherSummary: string; error?: string }> {
  await requireSectionAccess("schedule");
  const result = await refreshCallSheetData(callSheetId);
  return {
    weatherSummary: result.weatherSummary ?? "",
    error: result.error
  };
}

export async function updateCallSheetCrew(
  callSheetId: string,
  crew: Array<{ crewId: string; callTime?: string }>
): Promise<{ error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const parsed = updateCallSheetCrewSchema.safeParse({ callSheetId, crew });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const callSheet = await prisma.callSheet.findUnique({
    where: { id: callSheetId },
    include: { shootDay: { select: { projectId: true } } }
  });
  if (!callSheet || callSheet.shootDay.projectId !== projectId) return { error: "Call sheet not found" };
  const validCrewCount = await prisma.crewMember.count({
    where: { id: { in: parsed.data.crew.map((c) => c.crewId) }, projectId, isDeleted: false }
  });
  if (validCrewCount !== parsed.data.crew.length) return { error: "One or more crew members are invalid for this project" };

  await prisma.callSheetCrew.deleteMany({ where: { callSheetId } });
  if (parsed.data.crew.length > 0) {
    await prisma.callSheetCrew.createMany({
      data: parsed.data.crew.map((c) => ({
        callSheetId,
        crewId: c.crewId,
        callTime: c.callTime?.trim() || null
      }))
    });
  }

  await logAudit({
    projectId,
    action: "update",
    entityType: "CallSheet",
    entityId: callSheetId,
    changeNote: "Call sheet crew updated",
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${callSheet.shootDayId}/call-sheet`);
  return {};
}

/** Add any active crew not yet on this call sheet. */
export async function addMissingCallSheetCrew(
  callSheetId: string
): Promise<{ error?: string }> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();
  const callSheet = await prisma.callSheet.findUnique({
    where: { id: callSheetId },
    include: { crew: { select: { crewId: true } }, shootDay: { select: { projectId: true } } }
  });
  if (!callSheet || callSheet.shootDay.projectId !== projectId) return { error: "Call sheet not found" };

  const existingCrewIds = new Set(callSheet.crew.map((c) => c.crewId));
  const allCrew = await prisma.crewMember.findMany({
    where: { projectId, isDeleted: false },
    select: { id: true }
  });
  const toAdd = allCrew.filter((c) => !existingCrewIds.has(c.id));
  if (toAdd.length === 0) return {};

  await prisma.callSheetCrew.createMany({
    data: toAdd.map((c) => ({
      callSheetId,
      crewId: c.id
    }))
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "CallSheet",
    entityId: callSheetId,
    changeNote: `Added ${toAdd.length} missing crew to call sheet`,
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${callSheet.shootDayId}/call-sheet`);
  return {};
}

export type SendCallSheetEmailsResult = {
  success?: boolean;
  sentCount?: number;
  failedRecipients?: string[];
  error?: string;
};

export async function sendCallSheetEmails(input: {
  callSheetId: string;
  recipients: string[];
  subject: string;
  body: string;
}): Promise<SendCallSheetEmailsResult> {
  await requireSectionAccess("schedule");
  const projectId = await requireCurrentProjectId();

  if (!isEmailEnabled()) {
    return { error: "Email sending is not configured." };
  }

  const normalizedRecipients = Array.from(
    new Set(
      input.recipients
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const parsed = sendCallSheetEmailsSchema.safeParse({
    callSheetId: input.callSheetId,
    recipients: normalizedRecipients,
    subject: input.subject.trim(),
    body: input.body.trim()
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`call-sheet-email:${ip}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return { error: `Too many email sends. Try again in ${rl.retryAfterSeconds}s.` };
  }

  const callSheet = await prisma.callSheet.findUnique({
    where: { id: parsed.data.callSheetId },
    include: { shootDay: { select: { id: true, projectId: true } } }
  });
  if (!callSheet || callSheet.shootDay.projectId !== projectId) {
    return { error: "Call sheet not found" };
  }

  // Ensure skeleton call sheets are upgraded to full records before generating a PDF.
  const initializedCallSheet =
    (await getOrCreateCallSheet(callSheet.shootDay.id)) ?? callSheet;

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        recipients: [...parsed.data.recipients].sort(),
        subject: parsed.data.subject,
        body: parsed.data.body
      })
    )
    .digest("hex");

  const latestSend = await prisma.auditLog.findFirst({
    where: {
      projectId,
      entityType: "CallSheetEmail",
      entityId: initializedCallSheet.id
    },
    orderBy: { createdAt: "desc" }
  });

  if (latestSend?.after) {
    try {
      const lastAfter = JSON.parse(latestSend.after) as {
        fingerprint?: string;
      };
      const elapsedMs = Date.now() - latestSend.createdAt.getTime();
      if (lastAfter.fingerprint === fingerprint && elapsedMs < 5 * 60 * 1000) {
        return { error: "This exact email was sent recently. Refresh before sending again." };
      }
    } catch {
      // ignore malformed historical data
    }
  }

  const { filename, pdfBuffer } = await generateCallSheetPdf(
    initializedCallSheet.id,
    projectId
  );
  const pdfBase64 = pdfBuffer.toString("base64");

  const failedRecipients: string[] = [];
  for (const recipient of parsed.data.recipients) {
    try {
      await sendEmail(recipient, parsed.data.subject, parsed.data.body, {
        attachments: [{ filename, content: pdfBase64 }]
      });
    } catch {
      failedRecipients.push(recipient);
    }
  }

  const sentCount = parsed.data.recipients.length - failedRecipients.length;
  if (sentCount === 0) {
    return { error: "Failed to send emails. Please check your settings and try again." };
  }

  await logAudit({
    projectId,
    action: "create",
    entityType: "CallSheetEmail",
    entityId: initializedCallSheet.id,
    changeNote: `Call sheet email sent to ${sentCount} recipient${sentCount === 1 ? "" : "s"}`,
    after: {
      fingerprint,
      filename,
      subject: parsed.data.subject,
      recipients: parsed.data.recipients,
      failedRecipients,
      sentCount
    },
    performedBy: await getPerformedBy()
  });

  revalidatePath(`/production/schedule/${callSheet.shootDay.id}/call-sheet`);
  return {
    success: true,
    sentCount,
    failedRecipients: failedRecipients.length ? failedRecipients : undefined
  };
}
