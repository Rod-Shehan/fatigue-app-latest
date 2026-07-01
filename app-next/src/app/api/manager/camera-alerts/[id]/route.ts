import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  deleteCameraAlertIngest,
  isCameraAlertDeleteEnabled,
} from "@/lib/integrations/camera-alert-ingest-delete";
import { resolveManagerAlertTarget } from "@/lib/integrations/manager-alert-target";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/manager/camera-alerts/[id]
 * Pilot testing — remove one ingest row (and paired media/triage). Gated by CAMERA_ALERTS_ALLOW_DELETE.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCameraAlertDeleteEnabled()) {
    return NextResponse.json(
      { error: "Delete is disabled — set CAMERA_ALERTS_ALLOW_DELETE=true on the server" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  try {
    const target = await resolveManagerAlertTarget(prisma, id);
    const ingestId = target?.ingestEventId;
    if (!ingestId) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const result = await deleteCameraAlertIngest(prisma, ingestId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete event";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
