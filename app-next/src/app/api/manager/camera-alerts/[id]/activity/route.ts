import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { fetchIncidentActivityTimeline } from "@/lib/integrations/incident-activity-timeline";
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

  const { id: ingestEventId } = await context.params;
  const entries = await fetchIncidentActivityTimeline(prisma, { ingestEventId });
  return NextResponse.json({ entries });
}
