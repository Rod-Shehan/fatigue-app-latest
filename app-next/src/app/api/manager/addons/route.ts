import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy, resolveGpsMovementTrailEnabled } from "@/lib/system-policy";
import { prisma } from "@/lib/prisma";

/**
 * GET/PATCH /api/manager/addons — enterprise addon flags (manager/owner).
 * GPS movement trail is an optional addon; default off until enabled here or on Security.
 */

export async function GET() {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemPolicyRow();
  const policy = await getSystemPolicy();
  return NextResponse.json({
    gpsMovementTrailEnabled: resolveGpsMovementTrailEnabled(policy.gpsMovementTrailEnabled),
    policyGpsMovementTrailEnabled: policy.gpsMovementTrailEnabled,
  });
}

export async function PATCH(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await ensureSystemPolicyRow();
    if (typeof body.gpsMovementTrailEnabled !== "boolean") {
      return NextResponse.json({ error: "gpsMovementTrailEnabled boolean required" }, { status: 400 });
    }
    await prisma.systemPolicy.update({
      where: { id: "default" },
      data: {
        gpsMovementTrailEnabled: body.gpsMovementTrailEnabled,
        updatedById: manager.user.id,
      },
    });
    const policy = await getSystemPolicy();
    return NextResponse.json({
      gpsMovementTrailEnabled: resolveGpsMovementTrailEnabled(policy.gpsMovementTrailEnabled),
      policyGpsMovementTrailEnabled: policy.gpsMovementTrailEnabled,
    });
  } catch (e) {
    console.error("Manager addons PATCH error:", e);
    return NextResponse.json({ error: "Failed to update addons" }, { status: 500 });
  }
}
