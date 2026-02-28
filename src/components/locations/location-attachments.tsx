"use client";

import * as React from "react";
import { addLocationFile, removeLocationFile } from "@/actions/locations";
import { FilesSection } from "@/components/shared/files-section";
import { useRouter } from "next/navigation";

type LocationAttachmentsProps = {
  locationId: string;
  venueId: string;
  files: Array<{ id: string; fileName: string; filePath: string }>;
};

export function LocationAttachments({
  locationId,
  venueId,
  files,
}: LocationAttachmentsProps) {
  const router = useRouter();

  async function handleAttach(formData: FormData) {
    await addLocationFile(locationId, venueId, formData);
    router.refresh();
  }

  async function handleRemove(fileId: string) {
    await removeLocationFile(fileId);
    router.refresh();
  }

  return (
    <FilesSection
      items={files}
      onAttach={handleAttach}
      onRemove={handleRemove}
      fileServeBasePath="/api/location-files"
      title="Attachments"
      attachButtonLabel="Add Attachment"
    />
  );
}
