import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestAutonomiseWebhook } from "@/lib/integrations/autonomise-ingest";
import { runAutonomiseIngestFollowUp } from "@/lib/integrations/autonomise-ingest-followup";
import { getEnabledAlarmIdSet } from "@/lib/integrations/camera-alert-event-settings";
import {
  AUTONOMISE_WEBHOOK_SECRET_HEADER,
  getAutonomiseWebhookSecretFromEnv,
  verifyAutonomiseWebhookSecret,
} from "@/lib/integrations/autonomise-webhook-auth";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/autonomise/media
 * Autonomise Media webhook — clip-ready notifications; stored only when the linked event type is accepted.
 */
export async function POST(req: NextRequest) {
  const secret = getAutonomiseWebhookSecretFromEnv();
  if (!secret) {
    return NextResponse.json(
      { error: "Autonomise webhook not configured (AUTONOMISE_WEBHOOK_SECRET)" },
      { status: 503 }
    );
  }

  const headerSecret = req.headers.get(AUTONOMISE_WEBHOOK_SECRET_HEADER);
  if (!verifyAutonomiseWebhookSecret(headerSecret, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const enabledAlarmIds = await getEnabledAlarmIdSet(prisma);
    const result = await ingestAutonomiseWebhook(prisma, {
      kind: "media",
      payload,
      enabledAlarmIds,
    });

    after(async () => {
      await runAutonomiseIngestFollowUp(prisma, { kind: "media", payload, result });
    });

    return NextResponse.json({
      ok: true,
      kind: "media",
      ingestId: result.id,
      accepted: result.accepted,
      duplicate: result.duplicate,
      linkedEventId: result.linkedEventId,
      mediaUrl: result.mediaUrl,
      vehicleRego: result.vehicleRego,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "autonomise/media",
    method: "POST",
    header: AUTONOMISE_WEBHOOK_SECRET_HEADER,
    configured: Boolean(getAutonomiseWebhookSecretFromEnv()),
    apiConfigured: isAutonomiseApiConfigured(),
  });
}
