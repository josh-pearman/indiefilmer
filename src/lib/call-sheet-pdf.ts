import puppeteer from "puppeteer";
import { prisma } from "@/lib/db";
import { getShootDayNumberMap } from "@/lib/schedule";

export class CallSheetPdfError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "CallSheetPdfError";
  }
}

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

type PersonalCall = {
  name: string;
  role: string;
  type?: string;
  callTime: string;
  contact?: string;
};

export type GeneratedCallSheetPdf = {
  filename: string;
  pdfBuffer: Buffer;
};

export async function generateCallSheetPdf(
  callSheetId: string,
  projectId: string
): Promise<GeneratedCallSheetPdf> {
  const callSheet = await prisma.callSheet.findUnique({
    where: { id: callSheetId },
    include: {
      shootDay: {
        include: {
          location: true,
          scenes: {
            orderBy: { sortOrder: "asc" },
            include: {
              scene: {
                include: {
                  tags: true,
                  castAssignments: { include: { castMember: true } }
                }
              }
            }
          }
        }
      },
      crew: { include: { crew: true } }
    }
  });

  if (!callSheet) {
    throw new CallSheetPdfError(404, "Call sheet not found");
  }

  const shootDay = callSheet.shootDay;
  if (!shootDay || shootDay.isDeleted) {
    throw new CallSheetPdfError(404, "Shoot day not found");
  }
  if (shootDay.projectId !== projectId) {
    throw new CallSheetPdfError(403, "Forbidden");
  }

  const [crew, settings, dayNumberMap] = await Promise.all([
    prisma.crewMember.findMany({
      where: { projectId, isDeleted: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.projectSettings.findUnique({
      where: { projectId },
      select: { projectName: true }
    }),
    getShootDayNumberMap(projectId)
  ]);

  const dayNumber = dayNumberMap.get(shootDay.id) ?? 0;
  const projectName = settings?.projectName ?? "Untitled Project";

  const scenes: SceneRow[] = shootDay.scenes
    .filter((sds) => !sds.scene.isDeleted)
    .map((sds) => {
      const s = sds.scene;
      return {
        id: s.id,
        sceneNumber: s.sceneNumber,
        title: s.title,
        intExt: s.intExt,
        dayNight: s.dayNight,
        pageCount: s.pageCount,
        synopsis: s.synopsis,
        tags: s.tags.map((t) => t.tag),
        cast: s.castAssignments.map((a) => ({
          name: a.castMember.name,
          roleName: a.castMember.roleName,
          actorName: a.castMember.actorName
        }))
      };
    });

  let personalCallTimes: PersonalCall[] = [];
  try {
    if (callSheet.personalCallTimes) {
      const parsed = JSON.parse(callSheet.personalCallTimes) as PersonalCall[];
      if (Array.isArray(parsed)) personalCallTimes = parsed;
    }
  } catch {
    // ignore malformed historical data and continue with empty cast rows
  }

  const includedCrew = callSheet.crew.map((cs) => ({
    name: cs.crew.name,
    position: cs.crew.position,
    callTime: cs.callTime ?? "",
    phone: cs.crew.phone ?? "",
    email: cs.crew.email ?? "",
    includePhoneOnCallSheet: cs.crew.includePhoneOnCallSheet,
    includeEmailOnCallSheet: cs.crew.includeEmailOnCallSheet
  }));

  const dateFormatted = new Date(shootDay.date).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const html = renderCallSheetHtml({
    projectName,
    dayNumber,
    dateFormatted,
    callSheet: {
      generalCallTime: callSheet.generalCallTime,
      announcements: callSheet.announcements,
      weatherSummary: callSheet.weatherSummary,
      sunrise: callSheet.sunrise,
      sunset: callSheet.sunset,
      nearestHospital: callSheet.nearestHospital,
      emergencyContact: callSheet.emergencyContact,
      mapImageUrl: callSheet.mapImageUrl
    },
    shootDay: {
      notes: shootDay.notes,
      meals: shootDay.meals,
      transport: shootDay.transport,
      misc: shootDay.misc,
      callTime: shootDay.callTime,
      location: shootDay.location
        ? { name: shootDay.location.name, address: shootDay.location.address }
        : null
    },
    scenes,
    personalCallTimes,
    crew: includedCrew
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: process.env.PUPPETEER_EXECUTABLE_PATH
      ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      : [],
  });

  let pdfBuffer: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfArrayBuffer = await page.pdf({
      format: "Letter",
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
      printBackground: true
    });
    pdfBuffer = Buffer.from(pdfArrayBuffer);
  } finally {
    await browser.close();
  }

  const safeProject =
    projectName.replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 40) ||
    "project";
  const filename = `call-sheet-${safeProject}-day-${dayNumber || 0}.pdf`;

  return { filename, pdfBuffer };
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

function renderCallSheetHtml(data: {
  projectName: string;
  dayNumber: number;
  dateFormatted: string;
  callSheet: {
    generalCallTime: string | null;
    announcements: string | null;
    weatherSummary: string | null;
    sunrise: string | null;
    sunset: string | null;
    nearestHospital: string | null;
    emergencyContact: string | null;
    mapImageUrl: string | null;
  };
  shootDay: {
    notes: string | null;
    meals: number | null;
    transport: number | null;
    misc: number | null;
    callTime: string | null;
    location: { name: string; address: string | null } | null;
  };
  scenes: Array<{
    id: string;
    sceneNumber: string;
    title: string | null;
    intExt: string | null;
    dayNight: string | null;
    pageCount: number | null;
    cast: Array<{ name: string; roleName: string | null; actorName: string | null }>;
  }>;
  personalCallTimes: Array<{
    name: string;
    role: string;
    type?: string;
    callTime: string;
    contact?: string;
  }>;
  crew: Array<{
    name: string;
    position: string;
    callTime: string;
    phone: string;
    email: string;
    includePhoneOnCallSheet: boolean;
    includeEmailOnCallSheet: boolean;
  }>;
}): string {
  const {
    projectName,
    dayNumber,
    dateFormatted,
    callSheet,
    shootDay,
    scenes,
    personalCallTimes,
    crew
  } = data;

  const generalCall =
    callSheet.generalCallTime || shootDay.callTime || "—";

  const totalPages = scenes.reduce(
    (sum, s) => sum + (s.pageCount ?? 0),
    0
  );

  const sceneRows = scenes
    .map((s) => {
      const castStr = s.cast
        .map((c) =>
          c.actorName?.trim()
            ? `${c.actorName.trim()} (${c.name})`
            : c.roleName
              ? `${c.name} — ${c.roleName}`
              : c.name
        )
        .join(", ");
      return `<tr>
  <td>${s.sceneNumber}</td>
  <td>${s.title ?? "—"}</td>
  <td>${s.intExt ?? "—"}</td>
  <td>${s.dayNight ?? "—"}</td>
  <td>${s.pageCount ?? "—"}</td>
  <td>${castStr || "—"}</td>
</tr>`;
    })
    .join("\n");

  const castRows = personalCallTimes
    .map((r) => {
      const anyRow = r as typeof r & { characterName?: string };
      const characterName =
        anyRow.characterName ??
        (r.name.includes("(")
          ? r.name.split("(").pop()?.replace(")", "").trim()
          : r.role);
      const roleDisplay = characterName?.toUpperCase() ?? r.role;
      const ct = r.callTime?.trim() || generalCall;
      const displayName = r.name.replace(/\s*\(.*?\)\s*$/, "");
      return `<tr>
  <td>${displayName}</td>
  <td>${roleDisplay}</td>
  <td>${ct}</td>
  <td>${r.contact ?? "—"}</td>
</tr>`;
    })
    .join("\n");

  const crewRows = crew
    .map((c) => {
      const ct = c.callTime?.trim() || generalCall;
      const contact = buildContact(
        c.phone,
        c.email,
        c.includePhoneOnCallSheet,
        c.includeEmailOnCallSheet
      );
      return `<tr>
  <td>${c.name}</td>
  <td>${c.position}</td>
  <td>${ct}</td>
  <td>${contact}</td>
</tr>`;
    })
    .join("\n");

  const hasAnnouncements = !!callSheet.announcements?.trim();
  const hasNotes = !!shootDay.notes?.trim();
  const hasMap = !!callSheet.mapImageUrl;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charSet="utf-8" />
  <title>Call Sheet</title>
  <style>
    @page { size: Letter; margin: 0.5in; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.4; }
    * { box-sizing: border-box; }
    .call-time-banner { font-size: 16px; font-weight: bold; background: #111; color: #fff; padding: 4px 6px; text-align: center; margin: 0 0 8px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .info-box { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
    .info-box h3 { font-size: 10px; text-transform: uppercase; color: #666; margin: 0 0 4px 0; letter-spacing: 0.5px; }
    .info-box p { margin: 0; font-size: 11px; }
    .info-box .project-title { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .info-box .detail-line { font-size: 10px; color: #444; margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 12px; }
    th { background: #f0f0f0; text-align: left; padding: 4px 6px; border: 1px solid #ccc; font-size: 9px; text-transform: uppercase; }
    td { padding: 4px 6px; border: 1px solid #ccc; vertical-align: top; }
    .section-header { font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin: 12px 0 6px 0; letter-spacing: 0.5px; }
    .announcements { background: #fffde7; border: 1px solid #f0e68c; padding: 8px; margin-bottom: 12px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="call-time-banner">GENERAL CALL: ${generalCall}</div>

  <div class="info-grid">
    <div class="info-box">
      <div class="project-title">${projectName}</div>
      <p class="detail-line">Day ${dayNumber || 0} — ${dateFormatted}</p>
      <p class="detail-line" style="margin-top: 6px;">${callSheet.weatherSummary ?? "—"}</p>
      <p class="detail-line">☀️ Sunrise: ${callSheet.sunrise ?? "—"} &nbsp; 🌙 Sunset: ${
    callSheet.sunset ?? "—"
  }</p>
      <p class="detail-line" style="margin-top: 6px;"><strong>Nearest Hospital:</strong> ${callSheet.nearestHospital ?? "—"}</p>
      <p class="detail-line"><strong>Emergency Contact:</strong> ${callSheet.emergencyContact ?? "—"}</p>
    </div>
    <div class="info-box">
      <h3>Location</h3>
      <p><strong>${shootDay.location?.name ?? "—"}</strong></p>
      <p>${shootDay.location?.address ?? "—"}</p>
      ${
    hasMap
      ? `<img src="${callSheet.mapImageUrl}" alt="Location Map" style="width: 280px; height: 180px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; margin-top: 6px;" onerror="this.style.display='none'" />`
      : ""
  }
    </div>
  </div>

  ${
    hasAnnouncements
      ? `<div class="announcements">
    <strong>Announcements:</strong><br/>${callSheet.announcements}
  </div>`
      : ""
  }

  <div class="section-header">Scenes to Shoot — ${totalPages.toFixed(
    1
  )} pages</div>
  <table>
    <thead>
      <tr><th>#</th><th>Title</th><th>INT/EXT</th><th>D/N</th><th>Pages</th><th>Cast</th></tr>
    </thead>
    <tbody>
    ${sceneRows}
    </tbody>
  </table>

  <div class="section-header">Cast</div>
  <table>
    <thead>
      <tr><th>Name</th><th>Role</th><th>Call Time</th><th>Contact</th></tr>
    </thead>
    <tbody>
    ${castRows}
    </tbody>
  </table>

  <div class="section-header">Crew</div>
  <table>
    <thead>
      <tr><th>Name</th><th>Position</th><th>Call Time</th><th>Contact</th></tr>
    </thead>
    <tbody>
    ${crewRows}
    </tbody>
  </table>

  ${
    hasNotes
      ? `<div class="section-header">Notes</div>
  <p>${shootDay.notes}</p>`
      : ""
  }

</body>
</html>`;
}
