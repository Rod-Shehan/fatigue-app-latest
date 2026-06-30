import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  recordCameraAlertTriage,
  type CameraAlertTriageDecision,
} from "@/lib/integrations/camera-alert-triage";
import {
  assertManagerHoldsClaim,
  assertManagerOnShift,
  IncidentClaimError,
  resolveLifecycleIdForIngest,
} from "@/lib/integrations/incident-claim";
import { syncCommandLifecycleFromManagerTriage } from "@/lib/integrations/manager-lifecycle-sync";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/manager/camera-alerts/[id]/triage
 * Record Authorize follow-up or Dismiss as false positive (one decision per event).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: ingestEventId } = await context.params;

  let body: { decision?: string; note?: string | null; vendorEventId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "authorized" && decision !== "dismissed") {
    return NextResponse.json(
      { error: 'decision must be "authorized" or "dismissed"' },
      { status: 400 }
    );
  }

  try {
    await assertManagerOnShift(prisma, manager.user.id, manager.user.role);
    const lifecycleId = await resolveLifecycleIdForIngest(prisma, ingestEventId);
    if (lifecycleId) {
      await assertManagerHoldsClaim(prisma, lifecycleId, manager.user.id);
    }

    const record = await recordCameraAlertTriage(prisma, {
      ingestEventId,
      vendorEventId: body.vendorEventId ?? null,
      decision: decision as CameraAlertTriageDecision,
      note: body.note,
      decidedByUserId: manager.user.id,
      decidedByEmail: manager.user.email,
    });

    const lifecycle = await syncCommandLifecycleFromManagerTriage(prisma, {
      ingestEventId,
      decision: decision as CameraAlertTriageDecision,
      note: body.note,
      decidedByUserId: manager.user.id,
    });

    return NextResponse.json({
      ok: true,
      triage: {
        ingestEventId: record.ingestEventId,
        decision: record.decision,
        note: record.note,
        decidedByEmail: record.decidedByEmail,
        decidedAt: record.decidedAt.toISOString(),
      },
      lifecycleId: lifecycle.lifecycleId,
      lifecycleStatus: lifecycle.lifecycleStatus,
    });
  } catch (e) {
    if (e instanceof IncidentClaimError) {
      const status =
        e.code === "NOT_ON_SHIFT"
          ? 403
          : e.code === "NOT_CLAIMED_BY_YOU" || e.code === "ALREADY_CLAIMED"
            ? 409
            : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    const msg = e instanceof Error ? e.message : "Failed to record triage";
    if (msg === "ALREADY_DECIDED") {
      return NextResponse.json({ error: "This event was already reviewed" }, { status: 409 });
    }
    if (msg === "EVENT_NOT_FOUND") {
      return NextResponse.json({ error: "Event not found or not eligible for triage" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
