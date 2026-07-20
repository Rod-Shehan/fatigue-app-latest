import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSystemPolicy, resolveGpsMovementTrailEnabled } from "@/lib/system-policy";

/**
 * GET /api/features — session addons for driver/manager clients.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const policy = await getSystemPolicy();
  return NextResponse.json({
    gpsMovementTrailEnabled: resolveGpsMovementTrailEnabled(policy.gpsMovementTrailEnabled),
  });
}
