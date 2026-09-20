import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getOwnerSession } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import {
  maintenanceContactFromPolicy,
  normalizeMaintenanceContactPatch,
} from "@/lib/maintenance-contact";
import { outboundEmailConfigured } from "@/lib/email/outbound";
import { prisma } from "@/lib/prisma";

/**
 * GET — any signed-in user (send path still reads workshop + spares).
 * PATCH — Enterprise owner only. Not a client-manager setting.
 */

async function requireSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id?.trim() || null;
}

export async function GET() {
  const userId = await requireSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    console.error("Settings maintenance-contact PATCH error:", e);
    return NextResponse.json({ error: "Failed to update maintenance contact" }, { status: 500 });
  }
}
