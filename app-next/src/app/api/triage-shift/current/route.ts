import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildViewerOnShift, getTriageShiftSnapshot } from "@/lib/triage-shift";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/triage-shift/current
 * Shared shift banner for manager Live alerts (and owner preview).
 */
export async function GET() {
  const session = await getManagerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getTriageShiftSnapshot(prisma);
  const viewer = buildViewerOnShift(snapshot, {
    viewer: "manager",
    userId: session.user.id,
    userRole: session.user.role,
    onShift: false,
  });

  return NextResponse.json({
    snapshot,
    viewer: {
      onShift: viewer.onShift,
      userId: session.user.id,
    },
  });
}
