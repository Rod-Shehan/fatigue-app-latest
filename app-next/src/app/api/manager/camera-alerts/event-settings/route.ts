import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  getCameraAlertEventSettings,
  isValidEnabledAlarmPayload,
  saveCameraAlertEventSettings,
} from "@/lib/integrations/camera-alert-event-settings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manager/camera-alerts/event-settings
 * Tenant-enabled Autonomise alarm types for live alerts ingest + inbox.
 */
export async function GET() {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getCameraAlertEventSettings(prisma);
    return NextResponse.json({ settings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load event settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/manager/camera-alerts/event-settings
 * Update which alarm types are accepted into the live alerts inbox.
 */
export async function PATCH(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidEnabledAlarmPayload(body)) {
    return NextResponse.json(
      { error: "enabledAlarmIds must be an array of alarm id strings" },
      { status: 400 }
    );
  }

  if (body.enabledAlarmIds.length === 0) {
    return NextResponse.json(
      { error: "At least one event type must be enabled" },
      { status: 400 }
    );
  }

  try {
    const settings = await saveCameraAlertEventSettings(prisma, {
      enabledAlarmIds: body.enabledAlarmIds,
      updatedByUserId: manager.user.id,
    });
    return NextResponse.json({ settings });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to save event settings";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
