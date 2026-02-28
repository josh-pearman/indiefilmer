"use server";

import { revalidatePath } from "next/cache";
import path from "path";
import { writeFile, mkdir, unlink } from "fs/promises";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getPerformedBy } from "@/lib/auth";
import { requireCurrentProjectId, requireSectionAccess } from "@/lib/project";
import { validateFileType, validateFileSize } from "@/lib/file-validation";
import { checkStorageQuota } from "@/lib/storage-quota";
import {
  createLocationSchema,
  updateLocationSchema,
  updateLocationStatusSchema
} from "@/lib/validators";
import { syncTaskFromEntity } from "@/lib/task-entity-sync";

import { type ActionResult } from "@/lib/action-result";

function getLocationsUploadDir(projectId: string): string {
  return path.join(process.cwd(), "data/uploads", projectId, "locations");
}

function sanitizeLocationFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

type LocationVenueInput = {
  label: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  providerType?: string | null;
  providerLink?: string | null;
  estimatedCostPerDay?: number | null;
  numberOfDays?: number | null;
  fees?: number | null;
  costNotes?: string | null;
  notes?: string | null;
};

function syncLocationFromVenueData(
  input: Omit<LocationVenueInput, "label">
): Prisma.LocationUncheckedUpdateInput {
  return {
    address: input.address ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    providerType: input.providerType ?? null,
    providerLink: input.providerLink ?? null,
    estimatedCostPerDay: input.estimatedCostPerDay ?? null,
    numberOfDays: input.numberOfDays ?? null,
    fees: input.fees ?? null,
    costNotes: input.costNotes ?? null,
    notes: input.notes ?? null,
  };
}

function getVenuePayload(
  formData: FormData
): Omit<LocationVenueInput, "label"> {
  return {
    address: ((formData.get("address") as string) || "").trim() || null,
    latitude: parseNumOrNull(formData.get("latitude")) ?? null,
    longitude: parseNumOrNull(formData.get("longitude")) ?? null,
    providerType: ((formData.get("providerType") as string) || "").trim() || null,
    providerLink: ((formData.get("providerLink") as string) || "").trim() || null,
    estimatedCostPerDay: parseNum(formData.get("estimatedCostPerDay")) ?? null,
    numberOfDays: parseNum(formData.get("numberOfDays")) ?? null,
    fees: parseNum(formData.get("fees")) ?? null,
    costNotes: ((formData.get("costNotes") as string) || "").trim() || null,
    notes: ((formData.get("notes") as string) || "").trim() || null,
  };
}

function parseNum(value: FormDataEntryValue | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseNumOrNull(value: FormDataEntryValue | null): number | null | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function createLocation(
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const raw = {
    name: formData.get("name"),
    address: (formData.get("address") as string) || undefined,
    latitude: parseNumOrNull(formData.get("latitude")),
    longitude: parseNumOrNull(formData.get("longitude")),
    providerType: formData.get("providerType") || undefined,
    providerLink: formData.get("providerLink") ?? undefined,
    status: formData.get("status") ?? "Shortlist",
    estimatedCostPerDay: parseNum(formData.get("estimatedCostPerDay")),
    numberOfDays: parseNum(formData.get("numberOfDays")),
    fees: parseNum(formData.get("fees")),
    costNotes: (formData.get("costNotes") as string) || undefined,
    plannedAmount: parseNum(formData.get("plannedAmount")),
    notes: (formData.get("notes") as string) || undefined
  };
  const parsed = createLocationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: parsed.error.errors[0]?.message ?? "Invalid input"
    };
  }

  const data = parsed.data;
  const location = await prisma.location.create({
    data: {
      projectId,
      name: data.name,
      address: data.address ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      providerType: data.providerType ?? null,
      providerLink: data.providerLink === "" ? null : (data.providerLink ?? null),
      status: data.status,
      estimatedCostPerDay: data.estimatedCostPerDay ?? null,
      numberOfDays: data.numberOfDays ?? null,
      fees: data.fees ?? null,
      costNotes: data.costNotes ?? null,
      plannedAmount: data.plannedAmount ?? null,
      budgetBucket: "Locations",
      notes: data.notes ?? null
    }
  });

  const venue = await prisma.locationVenue.create({
    data: {
      locationId: location.id,
      label: "Venue 1",
      address: data.address ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      providerType: data.providerType ?? null,
      providerLink: data.providerLink === "" ? null : (data.providerLink ?? null),
      estimatedCostPerDay: data.estimatedCostPerDay ?? null,
      numberOfDays: data.numberOfDays ?? null,
      fees: data.fees ?? null,
      costNotes: data.costNotes ?? null,
      notes: data.notes ?? null,
    }
  });

  await prisma.location.update({
    where: { id: location.id },
    data: { selectedVenueId: venue.id }
  });

  await logAudit({
    projectId,
    action: "create",
    entityType: "Location",
    entityId: location.id,
    after: location,
    changeNote: `Location "${location.name}" created`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath("/");
  return {};
}

export async function updateLocation(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.location.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  const raw = {
    id,
    name: formData.get("name"),
    address: (formData.get("address") as string | null) ?? undefined,
    latitude: parseNumOrNull(formData.get("latitude")),
    longitude: parseNumOrNull(formData.get("longitude")),
    providerType: formData.get("providerType") || undefined,
    providerLink: formData.get("providerLink"),
    status: formData.get("status"),
    estimatedCostPerDay: parseNum(formData.get("estimatedCostPerDay")),
    numberOfDays: parseNum(formData.get("numberOfDays")),
    fees: parseNum(formData.get("fees")),
    costNotes: (formData.get("costNotes") as string | null) ?? undefined,
    plannedAmount: parseNum(formData.get("plannedAmount")),
    notes: (formData.get("notes") as string | null) ?? undefined
  };
  const parsed = updateLocationSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const updatePayload: Parameters<typeof prisma.location.update>[0]["data"] = {};
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.address !== undefined) updatePayload.address = data.address || null;
  if (data.latitude !== undefined) updatePayload.latitude = data.latitude;
  if (data.longitude !== undefined) updatePayload.longitude = data.longitude;
  if (data.providerType !== undefined)
    updatePayload.providerType = data.providerType ?? null;
  if (data.providerLink !== undefined)
    updatePayload.providerLink = data.providerLink === "" ? null : data.providerLink;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.estimatedCostPerDay !== undefined)
    updatePayload.estimatedCostPerDay = data.estimatedCostPerDay;
  if (data.numberOfDays !== undefined)
    updatePayload.numberOfDays = data.numberOfDays;
  if (data.fees !== undefined) updatePayload.fees = data.fees;
  if (data.costNotes !== undefined)
    updatePayload.costNotes = data.costNotes || null;
  if (data.plannedAmount !== undefined)
    updatePayload.plannedAmount = data.plannedAmount ?? null;
  if (data.notes !== undefined) updatePayload.notes = data.notes || null;

  const afterRecord = await prisma.location.update({
    where: { id },
    data: updatePayload
  });

  if (before.selectedVenueId) {
    await prisma.locationVenue.update({
      where: { id: before.selectedVenueId },
      data: {
        address: afterRecord.address,
        latitude: afterRecord.latitude,
        longitude: afterRecord.longitude,
        providerType: afterRecord.providerType,
        providerLink: afterRecord.providerLink,
        estimatedCostPerDay: afterRecord.estimatedCostPerDay,
        numberOfDays: afterRecord.numberOfDays,
        fees: afterRecord.fees,
        costNotes: afterRecord.costNotes,
        notes: afterRecord.notes
      }
    });
  }

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: id,
    before,
    after: afterRecord,
    performedBy: await getPerformedBy()
  });

  if (before.status !== afterRecord.status) {
    await syncTaskFromEntity("Location", id, afterRecord.status);
  }

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${id}`);
  revalidatePath("/production/schedule");
  revalidatePath("/script/scenes");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function updateLocationStatus(
  id: string,
  newStatus: string
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const parsed = updateLocationStatusSchema.safeParse({ id, status: newStatus });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  }

  const before = await prisma.location.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  const afterRecord = await prisma.location.update({
    where: { id },
    data: { status: parsed.data.status }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: `Status changed to ${parsed.data.status}`,
    performedBy: await getPerformedBy()
  });

  await syncTaskFromEntity("Location", id, parsed.data.status);

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${id}`);
  revalidatePath("/production/schedule");
  revalidatePath("/");
  return {};
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.location.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  await prisma.location.update({
    where: { id },
    data: { isDeleted: true }
  });

  await logAudit({
    projectId,
    action: "delete",
    entityType: "Location",
    entityId: id,
    before,
    changeNote: "Location soft deleted",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath("/production/schedule");
  revalidatePath("/script/scenes");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function restoreLocation(id: string): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.location.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  const afterRecord = await prisma.location.update({
    where: { id },
    data: { isDeleted: false }
  });

  await logAudit({
    projectId,
    action: "restore",
    entityType: "Location",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Location restored",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${id}`);
  revalidatePath("/production/schedule");
  revalidatePath("/script/scenes");
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function ensureLocationHasVenue(id: string): Promise<void> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const location = await prisma.location.findUnique({
    where: { id },
    include: { venues: { select: { id: true }, take: 1 } }
  });

  if (!location || location.projectId !== projectId || location.venues.length > 0) return;

  const venue = await prisma.locationVenue.create({
    data: {
      locationId: location.id,
      label: "Venue 1",
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      providerType: location.providerType,
      providerLink: location.providerLink,
      estimatedCostPerDay: location.estimatedCostPerDay,
      numberOfDays: location.numberOfDays,
      fees: location.fees,
      costNotes: location.costNotes,
      notes: location.notes
    }
  });

  await prisma.location.update({
    where: { id: location.id },
    data: { selectedVenueId: venue.id }
  });
}

export async function ensureLocationFilesAssignedToVenue(id: string): Promise<void> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const location = await prisma.location.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      selectedVenueId: true,
      venues: {
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: 1
      }
    }
  });

  if (!location || location.projectId !== projectId) return;

  const targetVenueId = location.selectedVenueId ?? location.venues[0]?.id;
  if (!targetVenueId) return;

  await prisma.locationFile.updateMany({
    where: { locationId: id, venueId: null },
    data: { venueId: targetVenueId }
  });
}

export async function updateLocationName(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const name = ((formData.get("name") as string) || "").trim();
  if (!name) return { error: "Name is required" };

  const before = await prisma.location.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  const afterRecord = await prisma.location.update({
    where: { id },
    data: { name }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Location name updated",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${id}`);
  revalidatePath("/script/scenes");
  revalidatePath("/production/schedule");
  revalidatePath("/");
  return {};
}

export async function updateLocationPlannedBudget(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const before = await prisma.location.findUnique({ where: { id } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  const raw = ((formData.get("plannedAmount") as string) || "").trim();
  const plannedAmount = raw === "" ? null : Number(raw);
  if (plannedAmount !== null && (!Number.isFinite(plannedAmount) || plannedAmount < 0)) {
    return { error: "Planned budget must be a non-negative number" };
  }

  const afterRecord = await prisma.location.update({
    where: { id },
    data: { plannedAmount }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: id,
    before,
    after: afterRecord,
    changeNote: "Planned budget updated",
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${id}`);
  revalidatePath("/accounting/expenses");
  revalidatePath("/");
  return {};
}

export async function addLocationVenue(
  locationId: string
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    include: { venues: { select: { id: true } } }
  });
  if (!location || location.projectId !== projectId) return { error: "Location not found" };

  const venue = await prisma.locationVenue.create({
    data: {
      locationId,
      label: `Venue ${location.venues.length + 1}`,
      address: null,
      latitude: null,
      longitude: null,
      providerType: null,
      providerLink: null,
      estimatedCostPerDay: null,
      numberOfDays: null,
      fees: null,
      costNotes: null,
      notes: null
    }
  });

  if (!location.selectedVenueId) {
    await prisma.location.update({
      where: { id: locationId },
      data: { selectedVenueId: venue.id }
    });
  }

  revalidatePath(`/production/locations/${locationId}`);
  revalidatePath("/production/locations");
  return {};
}

export async function selectLocationVenue(
  locationId: string,
  venueId: string
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const venue = await prisma.locationVenue.findUnique({
    where: { id: venueId }
  });
  if (!venue || venue.locationId !== locationId) {
    return { error: "Venue not found" };
  }

  const before = await prisma.location.findUnique({ where: { id: locationId } });
  if (!before || before.projectId !== projectId) return { error: "Location not found" };

  const afterRecord = await prisma.location.update({
    where: { id: locationId },
    data: {
      selectedVenueId: venueId,
      ...syncLocationFromVenueData({
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
        providerType: venue.providerType,
        providerLink: venue.providerLink,
        estimatedCostPerDay: venue.estimatedCostPerDay,
        numberOfDays: venue.numberOfDays,
        fees: venue.fees,
        costNotes: venue.costNotes,
        notes: venue.notes,
      })
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: locationId,
    before,
    after: afterRecord,
    changeNote: `Selected venue "${venue.label}"`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${locationId}`);
  revalidatePath("/accounting/expenses");
  revalidatePath("/production/schedule");
  revalidatePath("/script/scenes");
  revalidatePath("/");
  return {};
}

export async function updateLocationVenue(
  locationId: string,
  venueId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const venue = await prisma.locationVenue.findUnique({
    where: { id: venueId }
  });
  if (!venue || venue.locationId !== locationId) {
    return { error: "Venue not found" };
  }

  const label = ((formData.get("label") as string) || "").trim() || venue.label;
  const venuePayload = getVenuePayload(formData);

  const updatedVenue = await prisma.locationVenue.update({
    where: { id: venueId },
    data: {
      label,
      ...venuePayload
    }
  });

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || location.projectId !== projectId) return { error: "Location not found" };

  if (location.selectedVenueId === venueId) {
    const before = location;
    const afterRecord = await prisma.location.update({
      where: { id: locationId },
      data: syncLocationFromVenueData(venuePayload)
    });

    await logAudit({
      projectId,
      action: "update",
      entityType: "Location",
      entityId: locationId,
      before,
      after: afterRecord,
      changeNote: `Updated selected venue "${updatedVenue.label}"`,
      performedBy: await getPerformedBy()
    });
  }

  revalidatePath(`/production/locations/${locationId}`);
  revalidatePath("/production/locations");
  revalidatePath("/accounting/expenses");
  revalidatePath("/production/schedule");
  revalidatePath("/script/scenes");
  revalidatePath("/");
  return {};
}

export async function removeLocationVenue(
  locationId: string,
  venueId: string
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const venue = await prisma.locationVenue.findUnique({
    where: { id: venueId }
  });
  if (!venue || venue.locationId !== locationId) {
    return { error: "Venue not found" };
  }

  const remainingCount = await prisma.locationVenue.count({
    where: { locationId }
  });
  if (remainingCount <= 1) {
    return { error: "At least one venue is required" };
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || location.projectId !== projectId) return { error: "Location not found" };

  await prisma.locationVenue.delete({ where: { id: venueId } });

  if (location.selectedVenueId === venueId) {
    const replacement = await prisma.locationVenue.findFirst({
      where: { locationId },
      orderBy: { createdAt: "asc" }
    });

    if (replacement) {
      await prisma.location.update({
        where: { id: locationId },
        data: {
          selectedVenueId: replacement.id,
          ...syncLocationFromVenueData({
            address: replacement.address,
            latitude: replacement.latitude,
            longitude: replacement.longitude,
            providerType: replacement.providerType,
            providerLink: replacement.providerLink,
            estimatedCostPerDay: replacement.estimatedCostPerDay,
            numberOfDays: replacement.numberOfDays,
            fees: replacement.fees,
            costNotes: replacement.costNotes,
            notes: replacement.notes,
          })
        }
      });
    }
  }

  revalidatePath(`/production/locations/${locationId}`);
  revalidatePath("/production/locations");
  revalidatePath("/accounting/expenses");
  revalidatePath("/production/schedule");
  revalidatePath("/script/scenes");
  revalidatePath("/");
  return {};
}

export async function addLocationFile(
  locationId: string,
  venueId: string,
  formData: FormData
): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const location = await prisma.location.findUnique({ where: { id: locationId } });
  if (!location || location.projectId !== projectId) return { error: "Location not found" };

  const venue = await prisma.locationVenue.findUnique({ where: { id: venueId } });
  if (!venue || venue.locationId !== locationId) {
    return { error: "Venue not found" };
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "A file is required" };
  }

  const validation = validateFileType(file, "general");
  if (!validation.valid) return { error: validation.error };

  const sizeValidation = validateFileSize(file, "general");
  if (!sizeValidation.valid) return { error: sizeValidation.error };

  const quotaCheck = await checkStorageQuota(projectId, file.size);
  if (!quotaCheck.allowed) return { error: quotaCheck.error };

  const originalName = file.name ?? "file";
  const safeName = sanitizeLocationFilename(originalName);
  const id = crypto.randomUUID?.() ?? `lf-${Date.now()}`;
  const storedFilename = `${locationId}-${id}-${safeName}`;
  const locationsUploadDir = getLocationsUploadDir(projectId);
  const filePath = path.join(locationsUploadDir, storedFilename);

  await mkdir(locationsUploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const locationFile = await prisma.locationFile.create({
    data: {
      locationId,
      venueId,
      filePath: storedFilename,
      fileName: originalName
    }
  });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: locationId,
    after: { fileId: locationFile.id, fileName: originalName },
    changeNote: `File "${originalName}" attached to location`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${locationId}`);
  revalidatePath("/");
  return {};
}

export async function removeLocationFile(fileId: string): Promise<ActionResult> {
  await requireSectionAccess("locations");
  const projectId = await requireCurrentProjectId();
  const locationFile = await prisma.locationFile.findUnique({
    where: { id: fileId },
    include: { location: true }
  });
  if (!locationFile || locationFile.location.projectId !== projectId) return { error: "File not found" };

  const fullPath = path.join(getLocationsUploadDir(projectId), locationFile.filePath);
  try {
    await unlink(fullPath);
  } catch {
    // ignore missing file
  }

  await prisma.locationFile.delete({ where: { id: fileId } });

  await logAudit({
    projectId,
    action: "update",
    entityType: "Location",
    entityId: locationFile.locationId,
    before: { fileId: locationFile.id, fileName: locationFile.fileName },
    changeNote: `File "${locationFile.fileName}" removed from location`,
    performedBy: await getPerformedBy()
  });

  revalidatePath("/production/locations");
  revalidatePath(`/production/locations/${locationFile.locationId}`);
  revalidatePath("/");
  return {};
}
