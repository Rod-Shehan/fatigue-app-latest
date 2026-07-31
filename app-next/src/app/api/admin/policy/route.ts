import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import { normalizeMaintenanceContactPatch } from "@/lib/maintenance-contact";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  await ensureSystemPolicyRow();
  const policy = await getSystemPolicy();
  return NextResponse.json({ policy });
}

export async function PATCH(req: Request) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await ensureSystemPolicyRow();
    const data: Record<string, unknown> = { updatedById: owner.user.id };
    if (typeof body.loginDisabled === "boolean") data.loginDisabled = body.loginDisabled;
    if (typeof body.driverWritesDisabled === "boolean") data.driverWritesDisabled = body.driverWritesDisabled;
    if (typeof body.managerWritesDisabled === "boolean") data.managerWritesDisabled = body.managerWritesDisabled;
    if (typeof body.gpsMovementTrailEnabled === "boolean") {
      data.gpsMovementTrailEnabled = body.gpsMovementTrailEnabled;
    }
    if (body.maintenanceMessage === null || typeof body.maintenanceMessage === "string") {
      data.maintenanceMessage = body.maintenanceMessage;
    }
    const contactPatch = normalizeMaintenanceContactPatch(body);
    if ("error" in contactPatch) {
      return NextResponse.json({ error: contactPatch.error }, { status: 400 });
    }
    Object.assign(data, contactPatch);
    await prisma.systemPolicy.update({ where: { id: "default" }, data });
    const policy = await getSystemPolicy();
    return NextResponse.json({ policy });
  } catch {
    return NextResponse.json({ error: "Failed to update policy" }, { status: 500 });
  }
}
