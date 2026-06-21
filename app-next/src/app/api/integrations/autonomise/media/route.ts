import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestAutonomiseWebhook } from "@/lib/integrations/autonomise-ingest";
import {
  AUTONOMISE_WEBHOOK_SECRET_HEADER,
  getAutonomiseEventPresetFromEnv,
  getAutonomiseWebhookSecretFromEnv,
  verifyAutonomiseWebhookSecret,
} from "@/lib/integrations/autonomise-webhook-auth";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/autonomise/media
 * Autonomise Media webhook — clip-ready notifications; always stored when auth passes.
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
    const result = await ingestAutonomiseWebhook(prisma, {
      kind: "media",
      payload,
      preset: getAutonomiseEventPresetFromEnv(),
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
