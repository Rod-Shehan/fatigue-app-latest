import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { listCameraAlerts } from "@/lib/integrations/autonomise-alerts";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/manager/camera-alerts
 * Recent Autonomise fatigue events for manager live-alerts inbox (MTS pilot).
 */
export async function GET(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const acceptedOnly = searchParams.get("acceptedOnly") !== "false";
  const hours = Number(searchParams.get("hours") ?? "168");
  const triageFilterRaw = searchParams.get("triageFilter");
  const triageFilter =
    triageFilterRaw === "pending" || triageFilterRaw === "decided" || triageFilterRaw === "all"
      ? triageFilterRaw
      : "all";
  const backfillMedia = searchParams.get("backfillMedia") === "true";
  const limitRaw = Number(searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitRaw) ? limitRaw : undefined;

  try {
    const result = await listCameraAlerts(prisma, {
      acceptedOnly,
      hours: Number.isFinite(hours) ? hours : 168,
      triageFilter,
      backfillMedia,
      limit,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load alerts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
