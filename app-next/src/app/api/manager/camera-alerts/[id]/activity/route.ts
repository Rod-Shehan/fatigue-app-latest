import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { fetchIncidentActivityTimeline } from "@/lib/integrations/incident-activity-timeline";
import { resolveManagerAlertTarget } from "@/lib/integrations/manager-alert-target";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manager/camera-alerts/[id]/activity
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const target = await resolveManagerAlertTarget(prisma, id);
  if (!target?.lifecycleId && !target?.ingestEventId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const entries = await fetchIncidentActivityTimeline(prisma, {
    lifecycleId: target.lifecycleId,
    ingestEventId: target.ingestEventId,
  });
  return NextResponse.json({ entries });
}
