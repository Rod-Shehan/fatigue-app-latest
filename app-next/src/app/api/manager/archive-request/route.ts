import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  COLD_RETRIEVAL_SLA_BUSINESS_DAYS,
  getHotColdAccessPolicy,
  isWeekStartingInHotWindow,
} from "@/lib/hot-cold-records";
import { sendOutboundEmail, outboundEmailConfigured } from "@/lib/email/outbound";

const WEEK_YMD = /^\d{4}-\d{2}-\d{2}$/;

function opsInbox(): string {
  const raw =
    process.env.CIRCADIA_ARCHIVE_REQUEST_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "circadia24@gmail.com";
  return raw;
}

/**
 * POST /api/manager/archive-request
 * Manager/owner requests electronic SoR (data + signature) from long-term storage.
 * P3 stub: emails Circadia ops when Resend is configured; always logs structured request.
 */
export async function POST(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fromWeekStarting =
    typeof body === "object" && body && "fromWeekStarting" in body
      ? String((body as { fromWeekStarting?: unknown }).fromWeekStarting ?? "").trim()
      : "";
  const toWeekStarting =
    typeof body === "object" && body && "toWeekStarting" in body
      ? String((body as { toWeekStarting?: unknown }).toWeekStarting ?? "").trim()
      : "";
  const reason =
    typeof body === "object" && body && "reason" in body
      ? String((body as { reason?: unknown }).reason ?? "").trim()
      : "";

  if (!WEEK_YMD.test(fromWeekStarting) || !WEEK_YMD.test(toWeekStarting)) {
    return NextResponse.json(
      { error: "fromWeekStarting and toWeekStarting must be YYYY-MM-DD (week Sundays)." },
      { status: 400 }
    );
  }
  if (fromWeekStarting > toWeekStarting) {
    return NextResponse.json({ error: "fromWeekStarting must be on or before toWeekStarting." }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "Please include a short reason for the request." }, { status: 400 });
  }

  const policy = getHotColdAccessPolicy();
  const fromHot = isWeekStartingInHotWindow(fromWeekStarting);
  const toHot = isWeekStartingInHotWindow(toWeekStarting);
  const requestId = `arc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const payload = {
    requestId,
    fromWeekStarting,
    toWeekStarting,
    reason,
    requesterUserId: manager.user.id,
    requesterEmail: manager.user.email,
    requesterName: manager.user.name,
    requesterRole: manager.user.role,
    rangeFullyHot: fromHot && toHot,
    policy,
    slaBusinessDays: COLD_RETRIEVAL_SLA_BUSINESS_DAYS,
    at: new Date().toISOString(),
  };

  console.info("[archive-request]", JSON.stringify(payload));

  const text = [
    "Circadia cold / long-term electronic record request",
    `Request ID: ${requestId}`,
    `From week: ${fromWeekStarting}`,
    `To week: ${toWeekStarting}`,
    `Reason: ${reason}`,
    `Requester: ${manager.user.name ?? "—"} <${manager.user.email ?? "no-email"}> (${manager.user.role})`,
    `Range fully in live hot window: ${fromHot && toHot ? "yes" : "no"}`,
    `SLA (standard): ${COLD_RETRIEVAL_SLA_BUSINESS_DAYS} business days AWST`,
    "Deliver: electronic SoR pack (data + signature + attestation/audit). PDF optional reproduction only.",
    `Logged at: ${payload.at}`,
  ].join("\n");

  let emailStatus: "sent" | "not_configured" | "failed" = "not_configured";
  if (outboundEmailConfigured()) {
    const sent = await sendOutboundEmail({
      to: opsInbox(),
      subject: `[Circadia] Archive record request ${requestId}`,
      text,
      replyTo: manager.user.email ?? undefined,
    });
    emailStatus = sent.ok ? "sent" : sent.reason === "not_configured" ? "not_configured" : "failed";
    if (!sent.ok && sent.reason !== "not_configured") {
      console.error("[archive-request] email failed", sent.message);
    }
  }

  return NextResponse.json({
    ok: true,
    requestId,
    emailStatus,
    slaBusinessDays: COLD_RETRIEVAL_SLA_BUSINESS_DAYS,
    fulfillmentDoc: "app-next/docs/ops/cold-access-fulfillment.md",
    message:
      emailStatus === "sent"
        ? "Request received. Circadia will retrieve and reassemble the electronic record and contact you."
        : "Request logged. Circadia ops will follow up (outbound email not configured on this environment — request is still recorded in server logs).",
  });
}

/** GET policy for Enterprise / manager clients (no secrets). */
export async function GET() {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ policy: getHotColdAccessPolicy() });
}
