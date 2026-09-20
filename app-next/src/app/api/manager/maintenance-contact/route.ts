import { NextResponse } from "next/server";
import { getManagerSession, getOwnerSession } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import {
  maintenanceContactFromPolicy,
  normalizeMaintenanceContactPatch,
} from "@/lib/maintenance-contact";
import { outboundEmailConfigured } from "@/lib/email/outbound";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/manager/maintenance-contact — managers and owners may read.
 * PATCH — Enterprise owner only.
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
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json({ error: "Owner access required" }, { status: 403 });
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
            "Provide workshop contact name, company, email, phone, and/or spare emails",
        },
        { status: 400 }
      );
    }
    await prisma.systemPolicy.update({
      where: { id: "default" },
      data: {
        ...contactPatch,
        updatedById: owner.user.id,
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
