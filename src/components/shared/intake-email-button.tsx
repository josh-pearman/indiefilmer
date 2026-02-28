"use client";

import { useState, useRef } from "react";
import { generateIntakeToken, sendIntakeEmail, getIntakeTemplate } from "@/actions/intake";
import { renderTemplate } from "@/lib/intake-template";
import { createLogger } from "@/lib/logger";

const logger = createLogger("intake-email");

type IntakeEmailButtonProps = {
  type: "cast" | "crew";
  id: string;
  name: string;
  email?: string | null;
  intakeToken: string | null;
  projectName: string;
  emailEnabled?: boolean;
};

export function IntakeEmailButton({
  type,
  id,
  name,
  email,
  intakeToken,
  projectName,
  emailEnabled = false,
}: IntakeEmailButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);
  const tokenRef = useRef(intakeToken);

  const canSend = emailEnabled && !!email?.trim();

  async function ensureToken(): Promise<string | null> {
    if (tokenRef.current) return tokenRef.current;
    const result = await generateIntakeToken(type, id);
    if (result.error || !result.token) {
      logger.error("Failed to generate intake token", { error: result.error });
      return null;
    }
    tokenRef.current = result.token;
    return result.token;
  }

  async function handleSendEmail() {
    try {
      setLoading(true);
      const result = await sendIntakeEmail(type, id);
      if (result.error) {
        logger.error("Failed to send intake email", { error: result.error });
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
        return;
      }
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      logger.error("Failed to send intake email", { error: String(error) });
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyEmail() {
    try {
      setLoading(true);
      const token = await ensureToken();
      if (!token) return;

      const link = `${window.location.origin}/intake/${token}`;
      const template = await getIntakeTemplate();
      const vars = { firstName: name.split(" ")[0], name, projectName, link };
      const renderedSubject = renderTemplate(template.subject, vars);
      const renderedBody = renderTemplate(template.body, vars);
      const emailText = `Subject: ${renderedSubject}\n\n${renderedBody}`;

      await navigator.clipboard.writeText(emailText);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      logger.error("Failed to copy intake email", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenLink() {
    try {
      setLoading(true);
      const token = await ensureToken();
      if (!token) return;
      window.open(`${window.location.origin}/intake/${token}`, "_blank");
    } catch (error) {
      logger.error("Failed to open intake link", { error: String(error) });
    } finally {
      setLoading(false);
    }
  }

  const btnClass =
    "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors";

  if (loading) {
    return (
      <span className={btnClass}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="animate-spin">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
      </span>
    );
  }

  const feedbackIcon =
    status === "copied" || status === "sent" ? (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-500">
        <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : status === "error" ? (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-red-500">
        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ) : null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {canSend ? (
        <button
          type="button"
          title="Send intake email"
          onClick={handleSendEmail}
          className={btnClass}
          aria-label={`Send intake email to ${name}`}
        >
          {feedbackIcon ?? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2L9.5 14L7 9L2 6.5L14 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <button
          type="button"
          title="Copy intake email"
          onClick={handleCopyEmail}
          className={btnClass}
          aria-label={`Copy intake email for ${name}`}
        >
          {feedbackIcon ?? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M1.5 4.5L8 9L14.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      )}

      <button
        type="button"
        title="Open intake form"
        onClick={handleOpenLink}
        className={btnClass}
        aria-label={`Open intake form for ${name}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3H3.5A1.5 1.5 0 002 4.5v8A1.5 1.5 0 003.5 14h8a1.5 1.5 0 001.5-1.5V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 2h5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 2L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </span>
  );
}
