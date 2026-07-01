import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  claimIncidentForManager,
  IncidentClaimError,
  releaseIncidentClaimForManager,
} from "@/lib/integrations/incident-claim";
import { resolveManagerAlertTarget } from "@/lib/integrations/manager-alert-target";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/manager/camera-alerts/[id]/claim
 * Claim a pending incident on the shared lifecycle queue.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const target = await resolveManagerAlertTarget(prisma, id);
    if (!target?.lifecycleId) {
      return NextResponse.json({ error: "No active incident for this event" }, { status: 404 });
    }

    const claim = await claimIncidentForManager(prisma, {
      lifecycleId: target.lifecycleId,
      userId: manager.user.id,
      userRole: manager.user.role,
      userLabel: manager.user.name ?? manager.user.email ?? "Manager",
    });

    return NextResponse.json({ ok: true, claim });
  } catch (e) {
    if (e instanceof IncidentClaimError) {
      const status =
        e.code === "NOT_ON_SHIFT"
          ? 403
          : e.code === "ALREADY_CLAIMED" || e.code === "NOT_CLAIMED_BY_YOU"
            ? 409
            : e.code === "NOT_FOUND"
              ? 404
              : 400;
      return NextResponse.json({ error: e.message, code: e.code }, { status });
    }
    const msg = e instanceof Error ? e.message : "Failed to claim incident";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/manager/camera-alerts/[id]/claim
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const target = await resolveManagerAlertTarget(prisma, id);
    if (!target?.lifecycleId) {
      return NextResponse.json({ error: "No active incident for this event" }, { status: 404 });
    }

    const released = await releaseIncidentClaimForManager(prisma, {
      lifecycleId: target.lifecycleId,
      userId: manager.user.id,
    });
    if (!released) {
      return NextResponse.json({ error: "Could not release claim" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, lifecycleId: target.lifecycleId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to release claim";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
