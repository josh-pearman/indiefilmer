import { Resend } from "resend";
import { getAuthMode } from "./auth";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export type EmailAttachment = {
  filename: string;
  content: string | Buffer;
};

type SendEmailOptions = {
  attachments?: EmailAttachment[];
};

/** Whether a Resend API key is configured (enables direct email sending). */
export function isEmailEnabled(): boolean {
  return !!RESEND_API_KEY;
}

/**
 * Low-level send via Resend. Only requires RESEND_API_KEY — not tied to AUTH_MODE.
 * All higher-level senders delegate here.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  options?: SendEmailOptions
): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const resend = new Resend(RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    text,
    attachments: options?.attachments?.length ? options.attachments : undefined,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to send email");
  }
}

export async function sendLoginCode(email: string, code: string): Promise<void> {
  if (getAuthMode() !== "email") {
    throw new Error("Email auth is not enabled (AUTH_MODE is not 'email').");
  }

  await sendEmail(
    email,
    "Your indieFilmer login code",
    `Your one-time login code is: ${code}\n\nIt expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.`
  );
}

export async function sendInviteEmail(
  email: string,
  projectName: string,
  token: string,
  inviterName: string
): Promise<void> {
  if (getAuthMode() !== "email") {
    throw new Error("Email auth is not enabled (AUTH_MODE is not 'email').");
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3001";
  const inviteUrl = `${appUrl}/invite/${token}`;

  await sendEmail(
    email,
    `You've been invited to "${projectName}" on indieFilmer`,
    [
      `${inviterName} has invited you to collaborate on "${projectName}".`,
      "",
      `Click here to accept: ${inviteUrl}`,
      "",
      "This invite expires in 7 days.",
      "",
      "If you didn't expect this, you can ignore this email."
    ].join("\n")
  );
}
