import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import {
  maintenanceContactFromPolicy,
  normalizeMaintenanceContactPatch,
} from "@/lib/maintenance-contact";
import { outboundEmailConfigured } from "@/lib/email/outbound";
import { prisma } from "@/lib/prisma";

/**
 * GET/PATCH /api/manager/maintenance-contact — org workshop / maintenance destination
 * for WAHVA fault reporting (managers + owners).
 */

export async function GET() {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemPolicyRow();
  const policy = await getSystemPolicy();
  return NextResponse.json({
    contact: maintenanceContactFromPolicy(policy),
    outboundEmailConfigured: outboundEmailConfigured(),
  });
}

export async function PATCH(req: Request) {
  const manager = await getManagerSession();
  if (!manager) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await ensureSystemPolicyRow();
    const contactPatch = normalizeMaintenanceContactPatch(body);
    if ("error" in contactPatch) {
      return NextResponse.json({ error: contactPatch.error }, { status: 400 });
    }
    if (Object.keys(contactPatch).length === 0) {
      return NextResponse.json(
        {
          error:
            "Provide maintenanceContactName, maintenanceContactCompany, maintenanceContactEmail, and/or maintenanceContactPhone",
        },
        { status: 400 }
      );
    }
    await prisma.systemPolicy.update({
      where: { id: "default" },
      data: {
        ...contactPatch,
        updatedById: manager.user.id,
      },
    });
    const policy = await getSystemPolicy();
    return NextResponse.json({
      contact: maintenanceContactFromPolicy(policy),
      outboundEmailConfigured: outboundEmailConfigured(),
    });
  } catch (e) {
    console.error("Manager maintenance-contact PATCH error:", e);
    return NextResponse.json({ error: "Failed to update maintenance contact" }, { status: 500 });
  }
}
