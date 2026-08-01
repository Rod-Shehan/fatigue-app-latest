/**
 * Outbound email pathway for org notifications (WAHVA fault reporting next).
 * Configure with RESEND_API_KEY + EMAIL_FROM. Returns not_configured until set.
 */

export type OutboundEmailAttachment = {
  filename: string;
  /** Raw bytes — encoded to base64 for Resend. */
  content: Buffer | Uint8Array;
  contentType?: string;
};

export type OutboundEmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  attachments?: OutboundEmailAttachment[];
};

export type OutboundEmailResult =
  | { ok: true; provider: "resend"; id?: string }
  | { ok: false; reason: "not_configured" | "invalid_to" | "send_failed"; message: string };

function parseToList(to: string | string[]): string[] {
  const list = Array.isArray(to) ? to : [to];
  return list.map((e) => e.trim()).filter(Boolean);
}

export function outboundEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

async function sendViaResend(msg: OutboundEmailMessage, to: string[]): Promise<OutboundEmailResult> {
  const apiKey = process.env.RESEND_API_KEY!.trim();
  const from = process.env.EMAIL_FROM!.trim();
  const attachments = (msg.attachments ?? []).map((a) => ({
    filename: a.filename,
    content: Buffer.from(a.content).toString("base64"),
    content_type: a.contentType,
  }));
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      reply_to: msg.replyTo,
      ...(attachments.length ? { attachments } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      reason: "send_failed",
      message: `Resend HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
    };
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string };
  return { ok: true, provider: "resend", id: data.id };
}

/**
 * Send an outbound email when Resend is configured.
 * Returns not_configured so callers can fall back to mailto / queue later.
 */
export async function sendOutboundEmail(msg: OutboundEmailMessage): Promise<OutboundEmailResult> {
  const to = parseToList(msg.to);
  if (!to.length) {
    return { ok: false, reason: "invalid_to", message: "No recipient address" };
  }
  if (!outboundEmailConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Outbound email is not configured. Set RESEND_API_KEY + EMAIL_FROM on the server.",
    };
  }
  try {
    return await sendViaResend(msg, to);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown send error";
    return { ok: false, reason: "send_failed", message };
  }
}

/**
 * Placeholder for the WAHVA fault-reporting process (next phase).
 * Builds a standard subject/body and sends to the org maintenance contact when ready.
 */
export async function sendMaintenanceFaultReportEmail(input: {
  toEmail: string;
  contactName?: string | null;
  contactCompany?: string | null;
  subject: string;
  body: string;
  replyTo?: string;
}): Promise<OutboundEmailResult> {
  const introLines = [
    input.contactName ? `Attention: ${input.contactName}` : null,
    input.contactCompany ? `Company: ${input.contactCompany}` : null,
    "",
  ].filter((l) => l !== null) as string[];

  return sendOutboundEmail({
    to: input.toEmail,
    subject: input.subject,
    text: [...introLines, input.body].join("\n").trim(),
    replyTo: input.replyTo,
  });
}
