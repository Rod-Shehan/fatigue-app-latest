import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestAutonomiseWebhook } from "@/lib/integrations/autonomise-ingest";
import {
  AUTONOMISE_WEBHOOK_SECRET_HEADER,
  getAutonomiseEventPresetFromEnv,
  getAutonomiseWebhookSecretFromEnv,
  verifyAutonomiseWebhookSecret,
} from "@/lib/integrations/autonomise-webhook-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleWebhook(req: NextRequest, kind: "event" | "media") {
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
    const result = await ingestAutonomiseWebhook(prisma, {
      kind,
      payload,
      preset: getAutonomiseEventPresetFromEnv(),
    });

    return NextResponse.json({
      ok: true,
      kind,
      ingestId: result.id,
      accepted: result.accepted,
      duplicate: result.duplicate,
      vendorAlarmId: result.vendorAlarmId,
      displayName: result.displayName,
      rejectReason: result.rejectReason,
      vehicleRego: result.vehicleRego,
      mediaUrl: result.mediaUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/integrations/autonomise/events
 * Autonomise Event webhook — validates x-webhook-secret, stores payload, filters fatigue catalogue.
 */
export async function POST(req: NextRequest) {
  return handleWebhook(req, "event");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "autonomise/events",
    method: "POST",
    header: AUTONOMISE_WEBHOOK_SECRET_HEADER,
    configured: Boolean(getAutonomiseWebhookSecretFromEnv()),
    preset: getAutonomiseEventPresetFromEnv(),
  });
}
