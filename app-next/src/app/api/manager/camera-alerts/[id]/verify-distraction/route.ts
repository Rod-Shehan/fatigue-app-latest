import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { completeManagerVerifiedDistraction } from "@/lib/integrations/incident-resolution";
import {
  assertManagerHoldsClaim,
  assertManagerOnShift,
  IncidentClaimError,
} from "@/lib/integrations/incident-claim";
import { resolveManagerAlertTarget } from "@/lib/integrations/manager-alert-target";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/manager/camera-alerts/[id]/verify-distraction
 * Record verified distraction + trigger reasons and close the incident.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: {
    verifiedDistractionReasons?: string[];
    note?: string | null;
    vendorEventId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    await assertManagerOnShift(prisma, manager.user.id, manager.user.role);
    const target = await resolveManagerAlertTarget(prisma, id);
    if (!target?.ingestEventId) {
      return NextResponse.json({ error: "Event not found or not eligible for triage" }, { status: 404 });
    }
    const ingestEventId = target.ingestEventId;
    if (target.lifecycleId) {
      await assertManagerHoldsClaim(prisma, target.lifecycleId, manager.user.id);
    }

    const result = await completeManagerVerifiedDistraction(prisma, {
      ingestEventId,
      vendorEventId: body.vendorEventId ?? null,
      verifiedDistractionReasons: body.verifiedDistractionReasons,
      note: body.note,
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
        verifiedDistractionReasons: result.triage.verifiedDistractionReasons,
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
    const msg = e instanceof Error ? e.message : "Failed to record verified distraction";
    if (msg === "ALREADY_DECIDED") {
      return NextResponse.json({ error: "This event was already reviewed" }, { status: 409 });
    }
    if (msg === "EVENT_NOT_FOUND") {
      return NextResponse.json({ error: "Event not found or not eligible for triage" }, { status: 404 });
    }
    if (msg === "VERIFIED_DISTRACTION_REASONS_REQUIRED") {
      return NextResponse.json(
        { error: "Select at least one verified distraction trigger reason" },
        { status: 400 }
      );
    }
    if (msg === "TRIAGE_TRIGGER_FREE_NOTE_REQUIRED") {
      return NextResponse.json(
        { error: "Enter details below when Other is selected" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
