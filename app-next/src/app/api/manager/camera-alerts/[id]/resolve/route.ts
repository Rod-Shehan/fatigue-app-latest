import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { completeManagerIncidentResolution } from "@/lib/integrations/incident-resolution";
import {
  assertManagerHoldsClaim,
  assertManagerOnShift,
  IncidentClaimError,
  resolveLifecycleIdForIngest,
} from "@/lib/integrations/incident-claim";
import { isIncidentResolutionActionType } from "@/lib/triage-resolution";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/manager/camera-alerts/[id]/resolve
 * Record verified fatigue + resolution action and close the incident.
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

  let body: {
    actionType?: string;
    resolutionNotes?: string | null;
    vendorEventId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.actionType || !isIncidentResolutionActionType(body.actionType)) {
    return NextResponse.json({ error: "actionType is required and must be valid" }, { status: 400 });
  }

  try {
    await assertManagerOnShift(prisma, manager.user.id, manager.user.role);
    const lifecycleId = await resolveLifecycleIdForIngest(prisma, ingestEventId);
    if (lifecycleId) {
      await assertManagerHoldsClaim(prisma, lifecycleId, manager.user.id);
    }

    const result = await completeManagerIncidentResolution(prisma, {
      ingestEventId,
      vendorEventId: body.vendorEventId ?? null,
      actionType: body.actionType,
      resolutionNotes: body.resolutionNotes,
      decidedByUserId: manager.user.id,
      decidedByEmail: manager.user.email,
      decidedByName: manager.user.name,
    });

    return NextResponse.json({
      ok: true,
      triage: {
        ingestEventId: result.triage.ingestEventId,
        decision: result.triage.decision,
        note: result.triage.note,
        decidedByEmail: result.triage.decidedByEmail,
        decidedAt: result.triage.decidedAt.toISOString(),
      },
      lifecycleId: result.lifecycleId,
      lifecycleStatus: result.lifecycleStatus,
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
    const msg = e instanceof Error ? e.message : "Failed to record resolution";
    if (msg === "ALREADY_DECIDED") {
      return NextResponse.json({ error: "This event was already reviewed" }, { status: 409 });
    }
    if (msg === "EVENT_NOT_FOUND") {
      return NextResponse.json({ error: "Event not found or not eligible for triage" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
