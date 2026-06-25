import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  isAutonomiseBlockBridgeEnabled,
} from "@/lib/integrations/autonomise-block-bridge-config";
import { manualBridgeAutonomiseEvents } from "@/lib/integrations/autonomise-block-bridge";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const MANUAL_BRIDGE_MAX_IDS = 50;

/**
 * POST /api/manager/autonomise-block-bridge/attribute
 * Manual metrics attribution when sheet-duty auto-match did not run.
 * Body: { driverName: string, ingestIds: string[] }
 */
export async function POST(request: Request) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAutonomiseBlockBridgeEnabled()) {
    return NextResponse.json(
      { error: "Block bridge is disabled — set AUTONOMISE_BLOCK_BRIDGE_ENABLED=true" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const driverName =
    typeof (body as { driverName?: unknown }).driverName === "string"
      ? (body as { driverName: string }).driverName.trim()
      : "";
  const ingestIds = Array.isArray((body as { ingestIds?: unknown }).ingestIds)
    ? (body as { ingestIds: unknown[] }).ingestIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    : [];

  if (!driverName) {
    return NextResponse.json({ error: "driverName required" }, { status: 400 });
  }
  if (ingestIds.length === 0) {
    return NextResponse.json({ error: "ingestIds must be a non-empty array" }, { status: 400 });
  }
  if (ingestIds.length > MANUAL_BRIDGE_MAX_IDS) {
    return NextResponse.json(
      { error: `Too many ingestIds — maximum ${MANUAL_BRIDGE_MAX_IDS} per request` },
      { status: 400 }
    );
  }

  try {
    const result = await manualBridgeAutonomiseEvents(prisma, {
      ingestIds,
      driverName,
      attributedByUserId: manager.user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Attribute failed";
    if (msg === "BRIDGE_DISABLED") {
      return NextResponse.json({ error: "Block bridge disabled" }, { status: 403 });
    }
    if (msg === "NO_USER_FOR_DRIVER") {
      return NextResponse.json(
        { error: "No login user found for that driver — add email on Approved Drivers first" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "manager/autonomise-block-bridge/attribute",
    enabled: isAutonomiseBlockBridgeEnabled(),
    maxIds: MANUAL_BRIDGE_MAX_IDS,
  });
}
