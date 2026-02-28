"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  updateCallSheet,
  findNearestER,
  updateCallSheetCrew,
  addMissingCallSheetCrew,
  updateLocationAddress,
  sendCallSheetEmails
} from "@/actions/call-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Mail } from "lucide-react";
import { toast } from "sonner";

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
  characterName?: string;
  type?: string;
  callTime: string;
  contact?: string;
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

type CrewOption = {
  id: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  includePhoneOnCallSheet: boolean;
  includeEmailOnCallSheet: boolean;
};

type InitialData = {
  shootDayDateFormatted: string;
  projectName?: string;
  dayNumber?: number;
  shootDay: {
    id: string;
    date: string;
    callTime: string | null;
    status: string;
    notes: string | null;
    meals: number | null;
    transport: number | null;
    misc: number | null;
  };
  location: { id: string; name: string; address: string | null } | null;
  scenes: SceneRow[];
  crew: CrewOption[];
  emergencyContacts: Array<{
    name: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
  }>;
  castEmails: Array<{ name: string; email: string }>;
  callSheet: {
    id: string;
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
  lastEmailSentAt?: string | null;
  callSheetCrew: CallSheetCrewRow[];
};

const TAG_LABELS: Record<string, string> = {
  sound_risk: "🔊",
  permit_risk: "⚠️",
  stunts: "🤸",
  intimacy: "💬",
  vfx: "✨",
  special_props: "📦",
  crowd: "👥",
  night_ext: "🌙"
};

function tagDisplay(tag: string) {
  return TAG_LABELS[tag] ?? tag;
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RecipientRow = {
  id: string;
  name: string;
  email: string;
  source: "Cast" | "Crew" | "Manual";
  selected: boolean;
};

function makeRecipientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function PrepEmailsDialog({
  castEmails,
  crewSelection,
  dayNumber,
  dateFormatted,
  projectName,
  callSheetId,
  emailEnabled,
  lastEmailSentAt
}: {
  castEmails: Array<{ name: string; email: string }>;
  crewSelection: Array<{ included: boolean; name: string; email: string; position: string }>;
  dayNumber: number;
  dateFormatted: string;
  projectName: string;
  callSheetId: string;
  emailEnabled: boolean;
  lastEmailSentAt?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [copyEmailsFeedback, setCopyEmailsFeedback] = React.useState(false);
  const [copyAllFeedback, setCopyAllFeedback] = React.useState(false);
  const [manualEmails, setManualEmails] = React.useState("");
  const [showPdfPreview, setShowPdfPreview] = React.useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = React.useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = React.useState(false);
  const [pdfPreviewError, setPdfPreviewError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [confirmingSend, setConfirmingSend] = React.useState(false);
  const [lastSentAt, setLastSentAt] = React.useState<string | null>(lastEmailSentAt ?? null);

  const defaultSubject = `${projectName} - Call Sheet - Day ${dayNumber} - ${dateFormatted}`;
  const defaultBody = `Call sheet for Day ${dayNumber} - ${dateFormatted} attached. Please let me know if you have any questions.`;

  const baseRecipients = React.useMemo(() => {
    const seen = new Set<string>();
    const rows: RecipientRow[] = [];
    const missingPeople: string[] = [];

    for (const c of castEmails) {
      const e = c.email?.trim();
      if (!e) {
        missingPeople.push(c.name);
        continue;
      }
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: `cast-${c.name}-${key}`,
        name: c.name,
        email: e,
        source: "Cast",
        selected: true
      });
    }
    for (const c of crewSelection) {
      if (!c.included) continue;
      const e = c.email?.trim();
      if (!e) {
        missingPeople.push(`${c.name} (${c.position})`);
        continue;
      }
      const key = e.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        id: `crew-${c.name}-${key}`,
        name: c.name,
        email: e,
        source: "Crew",
        selected: true
      });
    }
    return { rows, missingPeople };
  }, [castEmails, crewSelection]);

  const [recipients, setRecipients] = React.useState<RecipientRow[]>(baseRecipients.rows);
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState(defaultBody);

  React.useEffect(() => {
    if (!open) return;
    setRecipients(baseRecipients.rows);
    setSubject(defaultSubject);
    setBody(defaultBody);
    setManualEmails("");
    setShowPdfPreview(false);
    setPdfPreviewError(null);
    setConfirmingSend(false);
  }, [open, baseRecipients.rows, defaultSubject, defaultBody]);

  const selectedRecipients = React.useMemo(
    () =>
      recipients
        .filter((r) => r.selected && EMAIL_REGEX.test(r.email.trim()))
        .map((r) => r.email.trim().toLowerCase()),
    [recipients]
  );

  const invalidSelectedCount = React.useMemo(
    () =>
      recipients.filter(
        (r) => r.selected && r.email.trim() && !EMAIL_REGEX.test(r.email.trim())
      ).length,
    [recipients]
  );

  const previewUrl = `/api/call-sheets/${callSheetId}/pdf`;
  const effectiveLastSentAt = lastSentAt ?? null;

  React.useEffect(() => {
    if (!showPdfPreview) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPreview() {
      setPdfPreviewLoading(true);
      setPdfPreviewError(null);
      try {
        const res = await fetch(previewUrl);
        if (!res.ok) {
          throw new Error("Failed to load PDF preview.");
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setPdfPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objectUrl;
          });
        }
      } catch {
        if (!cancelled) {
          setPdfPreviewError("Could not load preview. Open PDF in a new tab instead.");
          setPdfPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!cancelled) {
          setPdfPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [showPdfPreview, previewUrl]);

  React.useEffect(() => {
    if (showPdfPreview) return;
    setPdfPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [showPdfPreview]);

  const handleCopyEmails = async () => {
    await navigator.clipboard.writeText(selectedRecipients.join(", "));
    setCopyEmailsFeedback(true);
    setTimeout(() => setCopyEmailsFeedback(false), 2000);
  };

  const handleCopyAll = async () => {
    const text = `Bcc: ${selectedRecipients.join(", ")}\nSubject: ${subject}\n\n${body}`;
    await navigator.clipboard.writeText(text);
    setCopyAllFeedback(true);
    setTimeout(() => setCopyAllFeedback(false), 2000);
  };

  const handleAddManual = () => {
    const nextValues = manualEmails
      .split(/[,\n;]/)
      .map((value) => value.trim())
      .filter(Boolean);
    if (nextValues.length === 0) return;

    setRecipients((prev) => {
      const next = [...prev];
      for (const email of nextValues) {
        const existing = next.find(
          (r) => r.email.trim().toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          existing.selected = true;
          continue;
        }
        next.push({
          id: makeRecipientId("manual"),
          name: "Manual recipient",
          email,
          source: "Manual",
          selected: true
        });
      }
      return next;
    });
    setManualEmails("");
  };

  const handleSend = async () => {
    if (!emailEnabled) return;
    if (selectedRecipients.length === 0) {
      toast.error("Select at least one valid recipient.");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    if (!body.trim()) {
      toast.error("Body is required.");
      return;
    }

    setSending(true);
    try {
      const result = await sendCallSheetEmails({
        callSheetId,
        recipients: selectedRecipients,
        subject,
        body
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.failedRecipients?.length) {
        toast.warning(
          `Sent to ${result.sentCount ?? 0}. Failed: ${result.failedRecipients.join(", ")}`
        );
      } else {
        toast.success(`Sent to ${result.sentCount ?? selectedRecipients.length} recipient(s).`);
      }
      setLastSentAt(new Date().toISOString());
      setConfirmingSend(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <Mail className="h-4 w-4" />
          Prep Emails
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Prep Emails</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto">
          {effectiveLastSentAt && (
            <p className="text-xs text-muted-foreground">
              Last sent: {new Date(effectiveLastSentAt).toLocaleString()}
            </p>
          )}

          {baseRecipients.missingPeople.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Missing emails for {baseRecipients.missingPeople.length} person
              {baseRecipients.missingPeople.length === 1 ? "" : "s"}:{" "}
              {baseRecipients.missingPeople.join(", ")}
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">
                To ({selectedRecipients.length} recipient
                {selectedRecipients.length === 1 ? "" : "s"} selected)
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecipients(baseRecipients.rows)}
                >
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyEmails}
                  disabled={selectedRecipients.length === 0}
                >
                  {copyEmailsFeedback ? "Copied!" : "Copy Emails"}
                </Button>
              </div>
            </div>
            <div className="max-h-64 overflow-auto rounded-md border border-input">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-2 py-1 text-left font-medium w-10">Send</th>
                    <th className="px-2 py-1 text-left font-medium">Name</th>
                    <th className="px-2 py-1 text-left font-medium">Email</th>
                    <th className="px-2 py-1 text-left font-medium w-20">Type</th>
                    <th className="px-2 py-1 text-left font-medium w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="px-2 py-1.5 align-top">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) =>
                            setRecipients((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, selected: e.target.checked } : r
                              )
                            )
                          }
                          className="h-4 w-4 rounded border-border"
                          aria-label={`Send to ${row.name}`}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">{row.name}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={row.email}
                          onChange={(e) =>
                            setRecipients((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? { ...r, email: e.target.value } : r
                              )
                            )
                          }
                          className="h-8 min-w-[180px]"
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top text-xs text-muted-foreground">
                        {row.source}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRecipients((prev) => prev.filter((r) => r.id !== row.id))
                          }
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recipients.length === 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                No recipients yet. Add one below.
              </p>
            )}
            {invalidSelectedCount > 0 && (
              <p className="mt-2 text-xs text-destructive">
                {invalidSelectedCount} selected recipient
                {invalidSelectedCount === 1 ? " has" : "s have"} an invalid email.
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Add extra emails (comma separated)"
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleAddManual}>
                Add
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Body</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs uppercase text-muted-foreground">Attachment</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPdfPreview((prev) => !prev)}
              >
                {showPdfPreview ? "Hide PDF Preview" : "Preview PDF"}
              </Button>
            </div>
            <p className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
              A fresh call sheet PDF is generated and attached when you send.
            </p>
            {showPdfPreview && (
              <div className="mt-2 space-y-2">
                {pdfPreviewLoading && (
                  <p className="text-sm text-muted-foreground">Loading PDF preview…</p>
                )}
                {pdfPreviewError && (
                  <p className="text-sm text-destructive">{pdfPreviewError}</p>
                )}
                {pdfPreviewUrl && (
                  <iframe
                    title="Call sheet PDF preview"
                    src={pdfPreviewUrl}
                    className="h-72 w-full rounded-md border border-input"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewUrl, "_blank")}
                >
                  Open PDF in New Tab
                </Button>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs uppercase text-muted-foreground">Email Preview</Label>
            <div className="mt-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
              <p>
                <span className="font-medium">Bcc:</span>{" "}
                {selectedRecipients.join(", ") || "—"}
              </p>
              <p>
                <span className="font-medium">Subject:</span> {subject || "—"}
              </p>
              <p className="mt-2">{body || "—"}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button type="button" onClick={handleCopyAll} disabled={selectedRecipients.length === 0}>
              {copyAllFeedback ? "Copied!" : "Copy All"}
            </Button>
            {!emailEnabled && (
              <p className="text-xs text-muted-foreground">
                Direct send is disabled. Use copy/paste in your email app.
              </p>
            )}
            {emailEnabled && !confirmingSend && (
              <Button
                type="button"
                variant="default"
                disabled={selectedRecipients.length === 0 || invalidSelectedCount > 0 || sending}
                onClick={() => setConfirmingSend(true)}
              >
                Send…
              </Button>
            )}
          </div>

          {emailEnabled && confirmingSend && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-sm">
                Send this call sheet email to {selectedRecipients.length} recipient
                {selectedRecipients.length === 1 ? "" : "s"}?
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  disabled={sending || selectedRecipients.length === 0 || invalidSelectedCount > 0}
                  onClick={handleSend}
                >
                  {sending ? "Sending…" : "Confirm Send"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={sending}
                  onClick={() => setConfirmingSend(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CallSheetEditor({
  shootDayId,
  initialData,
  emailEnabled
}: {
  shootDayId: string;
  initialData: InitialData;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [generalCallTime, setGeneralCallTime] = React.useState(
    initialData.callSheet.generalCallTime ?? initialData.shootDay.callTime ?? ""
  );
  const [announcements, setAnnouncements] = React.useState(
    initialData.callSheet.announcements ?? ""
  );
  const [weatherSummary, setWeatherSummary] = React.useState(
    initialData.callSheet.weatherSummary ?? ""
  );
  const [sunrise, setSunrise] = React.useState(
    initialData.callSheet.sunrise ?? ""
  );
  const [sunset, setSunset] = React.useState(
    initialData.callSheet.sunset ?? ""
  );
  const [nearestHospital, setNearestHospital] = React.useState(
    initialData.callSheet.nearestHospital ?? ""
  );
  const [emergencyContact, setEmergencyContact] = React.useState(
    initialData.callSheet.emergencyContact ?? ""
  );
  const [personalCallTimes, setPersonalCallTimes] = React.useState<PersonalCall[]>(() => {
    try {
      const raw = initialData.callSheet.personalCallTimes;
      if (!raw) return [];
      const parsed = JSON.parse(raw) as PersonalCall[];
      if (!Array.isArray(parsed)) return [];
      return parsed.map((row) => ({
        ...row,
        contact: row.contact ?? "—"
      }));
    } catch {
      return [];
    }
  });
  const [address, setAddress] = React.useState(
    initialData.location?.address ?? ""
  );
  const [mapImageUrl, setMapImageUrl] = React.useState(
    initialData.callSheet.mapImageUrl ?? null
  );
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [updatingAddress, setUpdatingAddress] = React.useState(false);
  const [findingER, setFindingER] = React.useState(false);
  const [crewSaving, setCrewSaving] = React.useState(false);
  const [pdfGenerating, setPdfGenerating] = React.useState(false);

  // Crew: for each crew option, included + callTime. Derived from initialData.crew + callSheetCrew.
  const [crewSelection, setCrewSelection] = React.useState(() => {
    const onSheet = new Map(
      initialData.callSheetCrew.map((cs) => [cs.crewId, { callTime: cs.callTime || "" }])
    );
    return initialData.crew.map((c) => ({
      ...c,
      included: onSheet.has(c.id),
      callTime: onSheet.get(c.id)?.callTime ?? ""
    }));
  });
  const castOnlyCallTimes = React.useMemo(
    () => personalCallTimes.filter((row) => row.type === "cast"),
    [personalCallTimes]
  );

  const missingCrewCount = React.useMemo(
    () =>
      initialData.crew.filter(
        (c) => !initialData.callSheetCrew.some((cs) => cs.crewId === c.id)
      ).length,
    [initialData.crew, initialData.callSheetCrew]
  );

  React.useEffect(() => {
    const onSheet = new Map(
      initialData.callSheetCrew.map((cs) => [cs.crewId, { callTime: cs.callTime || "" }])
    );
    setCrewSelection(
      initialData.crew.map((c) => ({
        ...c,
        included: onSheet.has(c.id),
        callTime: onSheet.get(c.id)?.callTime ?? ""
      }))
    );
  }, [
    initialData.crew,
    initialData.callSheetCrew,
    initialData.crew.length,
    initialData.callSheetCrew.length
  ]);

  const handleSave = async () => {
    setSaveStatus("saving");
    const payload = personalCallTimes.map((row) => ({
      name: row.name,
      role: row.role,
      type: row.type,
      callTime: row.callTime,
      contact: row.contact ?? "—"
    }));
    const result = await updateCallSheet(initialData.callSheet.id, {
      generalCallTime,
      announcements,
      weatherSummary,
      sunrise,
      sunset,
      nearestHospital,
      emergencyContact,
      personalCallTimes: JSON.stringify(payload)
    });
    if (result.error) {
      setSaveStatus("error");
    } else {
      setSaveStatus("saved");
      router.refresh();
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const handleFindER = async () => {
    setFindingER(true);
    const result = await findNearestER(initialData.callSheet.id);
    setFindingER(false);
    if (result.error) {
      setSaveStatus("error");
    } else if (result.nearestHospital) {
      setNearestHospital(result.nearestHospital);
    }
  };

  const setPersonalCallTime = (index: number, callTime: string) => {
    setPersonalCallTimes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], callTime };
      return next;
    });
  };

  const setPersonalCallContact = (index: number, contact: string) => {
    setPersonalCallTimes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], contact };
      return next;
    });
  };

  const setCrewIncluded = (crewId: string, included: boolean) => {
    setCrewSelection((prev) =>
      prev.map((c) =>
        c.id === crewId ? { ...c, included } : c
      )
    );
  };

  const setCrewCallTime = (crewId: string, callTime: string) => {
    setCrewSelection((prev) =>
      prev.map((c) => (c.id === crewId ? { ...c, callTime } : c))
    );
  };

  const handleSelectAllCrew = () => {
    setCrewSelection((prev) => prev.map((c) => ({ ...c, included: true })));
  };

  const handleDeselectAllCrew = () => {
    setCrewSelection((prev) => prev.map((c) => ({ ...c, included: false })));
  };

  const handleSaveCrew = async () => {
    setCrewSaving(true);
    const payload = crewSelection
      .filter((c) => c.included)
      .map((c) => ({ crewId: c.id, callTime: c.callTime.trim() || undefined }));
    const result = await updateCallSheetCrew(initialData.callSheet.id, payload);
    setCrewSaving(false);
    if (result.error) setSaveStatus("error");
    else router.refresh();
  };

  const handleAddMissingCrew = async () => {
    setCrewSaving(true);
    const result = await addMissingCallSheetCrew(initialData.callSheet.id);
    setCrewSaving(false);
    if (result.error) setSaveStatus("error");
    else router.refresh();
  };

  const handleUpdateAddress = async () => {
    if (!initialData.location) return;
    setUpdatingAddress(true);
    const result = await updateLocationAddress(initialData.callSheet.id, address);
    setUpdatingAddress(false);
    if (result.error) {
      setSaveStatus("error");
    } else {
      if (result.address != null) setAddress(result.address);
      if (result.weatherSummary != null) setWeatherSummary(result.weatherSummary);
      if (result.sunrise != null) setSunrise(result.sunrise);
      if (result.sunset != null) setSunset(result.sunset);
      if (result.mapImageUrl !== undefined) setMapImageUrl(result.mapImageUrl ?? null);
      if (result.nearestHospital != null) setNearestHospital(result.nearestHospital);
      router.refresh();
    }
  };

  const dateFormatted = initialData.shootDayDateFormatted;
  const includedCrew = crewSelection.filter((c) => c.included);

  const handleDownloadPdf = async () => {
    setPdfGenerating(true);
    try {
      const res = await fetch(
        `/api/call-sheets/${initialData.callSheet.id}/pdf`
      );
      if (!res.ok) {
        setPdfGenerating(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } finally {
      setPdfGenerating(false);
    }
  };

  return (
    <div className="call-sheet space-y-6">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button type="button" onClick={handleSave} disabled={saveStatus === "saving"}>
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadPdf}
          disabled={pdfGenerating}
        >
          {pdfGenerating ? "Generating PDF…" : "Generate PDF"}
        </Button>
        <PrepEmailsDialog
          castEmails={initialData.castEmails}
          crewSelection={crewSelection}
          dayNumber={initialData.dayNumber ?? 0}
          dateFormatted={dateFormatted}
          projectName={initialData.projectName ?? "Untitled Project"}
          callSheetId={initialData.callSheet.id}
          emailEnabled={emailEnabled}
          lastEmailSentAt={initialData.lastEmailSentAt}
        />
        {saveStatus === "error" && (
          <span className="text-sm text-destructive">Save failed.</span>
        )}
      </div>

      <Card className="call-sheet">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg">CALL SHEET — Production</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shoot Day: {dateFormatted} — Status: {initialData.shootDay.status}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <section>
            <Label className="text-xs uppercase text-muted-foreground">General call time</Label>
            <Input
              value={generalCallTime}
              onChange={(e) => setGeneralCallTime(e.target.value)}
              onBlur={handleSave}
              placeholder="e.g. 7:00 AM"
              className="mt-1 max-w-xs"
            />
          </section>
          <section>
            <p className="text-xs uppercase text-muted-foreground">Location</p>
            <p className="font-medium">{initialData.location?.name ?? "—"}</p>
            {initialData.location ? (
              <div className="mt-1 flex items-start gap-2">
                <AddressAutocomplete
                  defaultAddress={address}
                  autocompleteEnabled
                  rows={1}
                  placeholder="Location address"
                  className="flex-1 text-sm"
                  onAddressChange={(addr) => setAddress(addr)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUpdateAddress}
                  disabled={updatingAddress}
                  className="no-print shrink-0 mt-0.5"
                >
                  {updatingAddress ? "Updating…" : "Update location"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
            {mapImageUrl && (
              <div className="mt-2">
                <img
                  src={mapImageUrl}
                  alt={`Map of ${initialData.location?.name ?? "location"}`}
                  className="w-full max-w-[600px] rounded border"
                />
              </div>
            )}
          </section>

          <hr className="border-border" />

          <section>
            <Label className="text-xs uppercase text-muted-foreground">Weather</Label>
            <Input
              value={weatherSummary}
              onChange={(e) => setWeatherSummary(e.target.value)}
              onBlur={handleSave}
              placeholder="Weather summary"
              className="mt-1"
            />
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Label className="text-muted-foreground">Sunrise</Label>
                <Input
                  value={sunrise}
                  onChange={(e) => setSunrise(e.target.value)}
                  onBlur={handleSave}
                  placeholder="—"
                  className="h-8 w-24"
                />
              </span>
              <span className="flex items-center gap-1.5">
                <Label className="text-muted-foreground">Sunset</Label>
                <Input
                  value={sunset}
                  onChange={(e) => setSunset(e.target.value)}
                  onBlur={handleSave}
                  placeholder="—"
                  className="h-8 w-24"
                />
              </span>
            </div>
            <p className="mt-1 hidden text-sm print:block">
              ☀️ {sunrise || "—"} → 🌙 {sunset || "—"}
            </p>
          </section>
          <section>
            <Label className="text-xs uppercase text-muted-foreground">Nearest emergency room</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={nearestHospital}
                onChange={(e) => setNearestHospital(e.target.value)}
                onBlur={handleSave}
                placeholder="ER name and address"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFindER}
                disabled={findingER}
                className="no-print shrink-0"
              >
                {findingER ? "Finding…" : "Find nearest ER"}
              </Button>
            </div>
          </section>
          <section>
            <Label className="text-xs uppercase text-muted-foreground">Emergency contact</Label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={emergencyContact}
              onChange={(e) => {
                setEmergencyContact(e.target.value);
              }}
              onBlur={handleSave}
            >
              <option value="">Select crew member…</option>
              {initialData.crew.map((c) => {
                const digits = (c.phone ?? "").replace(/\D/g, "");
                const formatted = digits.length === 10
                  ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
                  : c.phone;
                const value = [c.name, formatted].filter(Boolean).join(" — ");
                return (
                  <option key={c.id} value={value}>
                    {c.name} ({c.position})
                  </option>
                );
              })}
            </select>
          </section>

          <hr className="border-border" />

          <section>
            <Label className="text-xs uppercase text-muted-foreground">Announcements</Label>
            <textarea
              value={announcements}
              onChange={(e) => setAnnouncements(e.target.value)}
              onBlur={handleSave}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </section>

          <hr className="border-border" />

          <section>
            <h3 className="mb-2 font-semibold">Individual call times (Cast)</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left font-medium">Name</th>
                    <th className="pb-2 text-left font-medium">Role</th>
                    <th className="pb-2 text-left font-medium">Call time</th>
                    <th className="pb-2 text-left font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {castOnlyCallTimes.map((row, i) => {
                    const globalIndex = personalCallTimes.findIndex(
                      (p) => p === row
                    );
                    const characterName =
                      row.characterName ??
                      (row.name.includes("(")
                        ? row.name.split("(").pop()?.replace(")", "").trim()
                        : row.role);
                    const roleDisplay =
                      characterName?.toUpperCase() ?? row.role;
                    return (
                      <tr key={globalIndex} className="border-b border-border/60">
                        <td className="py-1.5">{row.name.replace(/\s*\(.*?\)\s*$/, "")}</td>
                        <td className="py-1.5">{roleDisplay}</td>
                        <td className="py-1.5">
                          <Input
                            value={row.callTime}
                            onChange={(e) =>
                              setPersonalCallTime(globalIndex, e.target.value)
                            }
                            onBlur={handleSave}
                            className="h-8 w-28"
                          />
                        </td>
                        <td className="py-1.5">
                          <Input
                            value={row.contact ?? "—"}
                            onChange={(e) =>
                              setPersonalCallContact(globalIndex, e.target.value)
                            }
                            onBlur={handleSave}
                            className="h-8 min-w-[140px]"
                            placeholder="—"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {castOnlyCallTimes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No cast assigned to this day’s scenes.
              </p>
            )}
          </section>

          <hr className="border-border" />

          <section className="no-print">
            <h3 className="mb-2 font-semibold">Crew</h3>
            <p className="mb-2 text-sm text-muted-foreground">
              Choose which crew members appear on this call sheet. Set individual call times or leave blank to use the general call time.
            </p>
            <div className="mb-2 flex gap-2 no-print">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllCrew}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeselectAllCrew}
              >
                Deselect all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveCrew}
                disabled={crewSaving}
              >
                {crewSaving ? "Saving…" : "Save crew"}
              </Button>
              {missingCrewCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddMissingCrew}
                  disabled={crewSaving}
                >
                  Add missing crew ({missingCrewCount})
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-2 text-left font-medium w-8">Incl.</th>
                    <th className="pb-2 pr-2 text-left font-medium">Name</th>
                    <th className="pb-2 pr-2 text-left font-medium">Role</th>
                    <th className="pb-2 pr-2 text-left font-medium">Call time</th>
                    <th className="pb-2 text-left font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {crewSelection.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-1.5 pr-2">
                        <input
                          type="checkbox"
                          checked={c.included}
                          onChange={(e) => setCrewIncluded(c.id, e.target.checked)}
                          className="h-4 w-4 rounded border-border"
                          aria-label={`Include ${c.name} on call sheet`}
                        />
                      </td>
                      <td className="py-1.5 pr-2 font-medium">{c.name}</td>
                      <td className="py-1.5 pr-2">{c.position}</td>
                      <td className="py-1.5 pr-2">
                        <Input
                          value={c.callTime}
                          onChange={(e) => setCrewCallTime(c.id, e.target.value)}
                          onBlur={handleSaveCrew}
                          placeholder="General"
                          className="h-8 w-28"
                        />
                      </td>
                      <td className="py-1.5">
                        {buildContact(
                          c.phone,
                          c.email,
                          c.includePhoneOnCallSheet,
                          c.includeEmailOnCallSheet
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {crewSelection.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No crew members yet. Add crew in the Crew module.
              </p>
            )}
          </section>

          {/* Print: crew table (included only) */}
          <section className="hidden print:block">
            <h3 className="mb-2 font-semibold">Crew</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-2 text-left font-medium">Name</th>
                    <th className="pb-2 pr-2 text-left font-medium">Role</th>
                    <th className="pb-2 pr-2 text-left font-medium">Call time</th>
                    <th className="pb-2 text-left font-medium">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {includedCrew.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-1.5 pr-2">{c.name}</td>
                      <td className="py-1.5 pr-2">{c.position}</td>
                      <td className="py-1.5 pr-2">
                        {c.callTime.trim() || generalCallTime || "—"}
                      </td>
                      <td className="py-1.5">
                        {buildContact(
                          c.phone,
                          c.email,
                          c.includePhoneOnCallSheet,
                          c.includeEmailOnCallSheet
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-border" />

          <section>
            <h3 className="mb-2 font-semibold">Scene order</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-2 text-left font-medium">#</th>
                    <th className="pb-2 pr-2 text-left font-medium">INT/EXT</th>
                    <th className="pb-2 pr-2 text-left font-medium">D/N</th>
                    <th className="pb-2 pr-2 text-left font-medium">Pages</th>
                    <th className="pb-2 pr-2 text-left font-medium">Synopsis</th>
                    <th className="pb-2 text-left font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {initialData.scenes.map((scene) => (
                    <tr key={scene.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 font-medium">{scene.sceneNumber}</td>
                      <td className="py-2 pr-2">{scene.intExt ?? "—"}</td>
                      <td className="py-2 pr-2">{scene.dayNight ?? "—"}</td>
                      <td className="py-2 pr-2">{scene.pageCount ?? "—"}</td>
                      <td className="py-2 pr-2 max-w-[200px] truncate">
                        {scene.synopsis ?? "—"}
                      </td>
                      <td className="py-2">
                        {scene.tags.length
                          ? scene.tags.map((t) => tagDisplay(t)).join(" ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {initialData.scenes.map((scene) => (
              <div key={scene.id} className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium">{scene.sceneNumber}</span> Cast:{" "}
                {scene.cast.length
                  ? scene.cast
                      .map((c) => {
                        const displayName = c.actorName?.trim()
                          ? `${c.actorName.trim()} (${c.name})`
                          : c.name;
                        return c.roleName
                          ? `${displayName} — ${c.roleName}`
                          : displayName;
                      })
                      .join(", ")
                  : "—"}
              </div>
            ))}
          </section>

          <hr className="border-border" />

          <section>
            <h3 className="mb-1 font-semibold">Day notes</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {initialData.shootDay.notes ?? "—"}
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-semibold">Day costs</h3>
            <p className="text-sm">
              Meals: ${Number(initialData.shootDay.meals ?? 0).toFixed(0)} — Transport: $
              {Number(initialData.shootDay.transport ?? 0).toFixed(0)} — Misc: $
              {Number(initialData.shootDay.misc ?? 0).toFixed(0)}
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
