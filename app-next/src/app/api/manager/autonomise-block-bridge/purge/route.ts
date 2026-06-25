import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  isAutonomiseBlockBridgeEnabled,
  isAutonomiseBlockBridgePurgeEnabled,
} from "@/lib/integrations/autonomise-block-bridge-config";
import { purgeAutonomiseBridgeData } from "@/lib/integrations/autonomise-block-bridge-purge";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/manager/autonomise-block-bridge/purge
 * Undo pilot metrics bridge — deletes autonomise DriverRiskBlock rows + attribution table.
 * Live alert ingest rows are not deleted.
 */
export async function POST() {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAutonomiseBlockBridgePurgeEnabled()) {
    return NextResponse.json(
      {
        error:
          "Purge is disabled — set AUTONOMISE_BLOCK_BRIDGE_ALLOW_PURGE=true on the server",
      },
      { status: 403 }
    );
  }

  try {
    const result = await purgeAutonomiseBridgeData(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Purge failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "manager/autonomise-block-bridge/purge",
    bridgeEnabled: isAutonomiseBlockBridgeEnabled(),
    purgeEnabled: isAutonomiseBlockBridgePurgeEnabled(),
  });
}
