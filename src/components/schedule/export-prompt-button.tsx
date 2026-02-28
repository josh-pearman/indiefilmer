"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type PersonalCallRow = {
  name: string;
  role: string;
  type?: string;
  characterName?: string;
  callTime: string;
  contact?: string;
};

type SceneRow = {
  id: string;
  sceneNumber: string;
  title: string | null;
  intExt: string | null;
  dayNight: string | null;
  pageCount: number | null;
  synopsis: string | null;
  tags: string[];
  cast: Array<{ name: string; roleName: string | null; actorName: string | null }>;
};

type CallSheetCrewRow = {
  id: string;
  crewId: string;
  callTime: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  includePhoneOnCallSheet: boolean;
  includeEmailOnCallSheet: boolean;
};

type EmergencyContactRow = {
  name: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
};

export type ExportPromptData = {
  projectName: string;
  dayNumber: number;
  shootDayDateFormatted: string;
  callSheet: {
    generalCallTime: string | null;
    announcements: string | null;
    weatherSummary: string | null;
    sunrise: string | null;
    sunset: string | null;
    nearestHospital: string | null;
    emergencyContact: string | null;
    personalCallTimes: string | null;
    mapImageUrl?: string | null;
  };
  location: { name: string; address: string | null } | null;
  shootDay: {
    notes: string | null;
    meals: number | null;
    transport: number | null;
    misc: number | null;
  };
  scenes: SceneRow[];
  callSheetCrew: CallSheetCrewRow[];
  emergencyContacts: EmergencyContactRow[];
};

function escapeForPrompt(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s).trim();
}

function buildContact(
  phone: string,
  email: string,
  includePhone: boolean,
  includeEmail: boolean
): string {
  const parts: string[] = [];
  if (includeEmail && email?.trim()) parts.push(email.trim());
  if (includePhone && phone?.trim()) parts.push(phone.trim());
  return parts.length ? parts.join(", ") : "—";
}

export function buildCallSheetPrompt(data: ExportPromptData): string {
  const {
    projectName,
    dayNumber,
    shootDayDateFormatted,
    callSheet,
    location,
    shootDay,
    scenes,
    callSheetCrew,
    emergencyContacts
  } = data;

  const generalCallTime = escapeForPrompt(callSheet.generalCallTime) || "—";
  const locationName = escapeForPrompt(location?.name) || "—";
  const locationAddress = escapeForPrompt(location?.address) || "—";
  const weatherSummary = escapeForPrompt(callSheet.weatherSummary) || "—";
  const sunrise = escapeForPrompt(callSheet.sunrise) || "—";
  const sunset = escapeForPrompt(callSheet.sunset) || "—";
  const nearestHospital = escapeForPrompt(callSheet.nearestHospital) || "—";
  const emergencyContact = escapeForPrompt(callSheet.emergencyContact) || "—";
  const announcements = escapeForPrompt(callSheet.announcements);
  const dayNotes = escapeForPrompt(shootDay.notes);
  const meals = shootDay.meals;
  const transport = shootDay.transport;
  const misc = shootDay.misc;
  const hasCosts =
    meals != null || transport != null || misc != null;
  const mapImageUrl = escapeForPrompt(callSheet.mapImageUrl);

  let personalCallTimes: PersonalCallRow[] = [];
  try {
    if (callSheet.personalCallTimes) {
      const parsed = JSON.parse(callSheet.personalCallTimes) as PersonalCallRow[];
      if (Array.isArray(parsed)) personalCallTimes = parsed;
    }
  } catch {
    // leave empty
  }

  const sections: string[] = [];

  sections.push(`You are a professional film production designer. Create a beautifully designed, print-ready call sheet as a single HTML file. The call sheet should look professional and be optimized for printing on US Letter paper (8.5" x 11").

## Design Requirements

- Clean, professional layout suitable for a real film production
- Optimized for print: US Letter size, proper margins, no wasted space
- Use a clean sans-serif font (e.g., Inter, Helvetica, Arial)
- Black and white with subtle gray accents (prints well on any printer)
- All sections clearly labeled and visually separated
- Important safety info (nearest hospital, emergency contact) should be prominent
- The call sheet should fit on 1-2 pages maximum

## Project & Shoot Day Info

- **Project:** ${escapeForPrompt(projectName) || "Untitled Project"}
- **Shoot Day:** Day ${dayNumber} — ${shootDayDateFormatted}
- **General Call Time:** ${generalCallTime}
- **Location:** ${locationName}
- **Address:** ${locationAddress}

## Weather & Sun

- **Weather:** ${weatherSummary}
- **Sunrise:** ${sunrise}
- **Sunset:** ${sunset}

## Safety

- **Nearest Hospital:** ${nearestHospital}
- **Emergency Contact:** ${emergencyContact}`);

  if (mapImageUrl) {
    sections.push(`
## Location Map

Include this map image in the call sheet design:
![Location Map](${mapImageUrl})`);
  }

  if (announcements) {
    sections.push(`
## Announcements

${announcements}`);
  }

  if (dayNotes) {
    sections.push(`
## Day Notes

${dayNotes}`);
  }

  if (scenes.length > 0) {
    const totalPages = scenes.reduce(
      (sum, s) => sum + (s.pageCount ?? 0),
      0
    );
    const sceneLines = scenes.map((s) => {
      const castStr = s.cast
        .map((c) =>
          c.actorName?.trim()
            ? `${c.actorName.trim()} (${c.name})`
            : c.roleName
              ? `${c.name} — ${c.roleName}`
              : c.name
        )
        .join(", ");
      return `| ${s.sceneNumber} | ${escapeForPrompt(s.title) || "—"} | ${escapeForPrompt(s.intExt) || "—"} | ${escapeForPrompt(s.dayNight) || "—"} | ${s.pageCount ?? "—"} | ${castStr || "—"} |`;
    });
    sections.push(`
## Scenes to Shoot

| Scene # | Title | INT/EXT | Day/Night | Pages | Cast |
|---------|-------|---------|-----------|-------|------|
${sceneLines.join("\n")}

**Total pages:** ${totalPages.toFixed(1)}`);
  }

  if (personalCallTimes.length > 0) {
    const castLines = personalCallTimes.map((r) => {
      const characterName =
        r.characterName ??
        (r.name.includes("(")
          ? r.name.split("(").pop()?.replace(")", "").trim()
          : r.role);
      const roleDisplay = characterName?.toUpperCase() ?? r.role;
      return `| ${r.name} | ${roleDisplay} | ${
        r.callTime.trim() || generalCallTime
      } | ${r.contact ?? "—"} |`;
    });
    sections.push(`
## Cast Call Times

| Name | Role | Call Time | Contact |
|------|------|-----------|---------|
${castLines.join("\n")}`);
  }

  const includedCrew = callSheetCrew;
  if (includedCrew.length > 0) {
    const crewLines = includedCrew.map((c) => {
      const contact = buildContact(
        c.phone,
        c.email,
        c.includePhoneOnCallSheet,
        c.includeEmailOnCallSheet
      );
      const callTime = c.callTime?.trim() || generalCallTime;
      return `| ${c.name} | ${c.position} | ${callTime} | ${contact} |`;
    });
    sections.push(`
## Crew Call Times

| Name | Role | Call Time | Contact |
|------|------|-----------|---------|
${crewLines.join("\n")}`);
  }

  if (emergencyContacts.length > 0) {
    const ecLines = emergencyContacts.map(
      (r) =>
        `| ${r.name} | ${r.emergencyContactName || "—"} | ${r.emergencyContactPhone || "—"} | ${r.emergencyContactRelation || "—"} |`
    );
    sections.push(`
## Emergency Contacts

| Name | Emergency Contact | Phone | Relationship |
|------|-------------------|-------|--------------|
${ecLines.join("\n")}`);
  }

  if (hasCosts) {
    sections.push(`
## Day Costs

- **Meals:** $${Number(meals ?? 0).toFixed(0)}
- **Transport:** $${Number(transport ?? 0).toFixed(0)}
- **Misc:** $${Number(misc ?? 0).toFixed(0)}`);
  }

  sections.push(`

Please output a single, complete HTML file with embedded CSS. Make it print-ready with @media print styles. Do not use any external dependencies.`);

  return sections.join("");
}

type ExportPromptButtonProps = {
  data: ExportPromptData;
};

export function ExportPromptButton({ data }: ExportPromptButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      const prompt = buildCallSheetPrompt(data);
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        className="no-print"
      >
        {copied ? (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copy Design Prompt
          </>
        )}
      </Button>
      {copied && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Paste into Claude or ChatGPT to design your call sheet
        </span>
      )}
    </span>
  );
}
