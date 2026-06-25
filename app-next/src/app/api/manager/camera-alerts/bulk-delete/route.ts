import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  CAMERA_ALERT_BULK_DELETE_MAX,
  deleteCameraAlertIngestBatch,
  isCameraAlertDeleteEnabled,
} from "@/lib/integrations/camera-alert-ingest-delete";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/manager/camera-alerts/bulk-delete
 * Pilot testing — remove multiple ingest rows. Gated by CAMERA_ALERTS_ALLOW_DELETE.
 */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = Array.isArray((body as { ids?: unknown }).ids)
    ? (body as { ids: unknown[] }).ids.filter((id): id is string => typeof id === "string" && id.trim())
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }

  if (ids.length > CAMERA_ALERT_BULK_DELETE_MAX) {
    return NextResponse.json(
      { error: `Too many ids — maximum ${CAMERA_ALERT_BULK_DELETE_MAX} per request` },
      { status: 400 }
    );
  }

  try {
    const result = await deleteCameraAlertIngestBatch(prisma, ids);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
