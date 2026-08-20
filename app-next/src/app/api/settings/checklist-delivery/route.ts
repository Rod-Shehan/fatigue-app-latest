import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { outboundEmailConfigured } from "@/lib/email/outbound";
import {
  resolveChecklistDeliveryTo,
  normalizeChecklistDeliveryEmail,
} from "@/lib/checklist/checklist-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/PATCH /api/settings/checklist-delivery
 * Signed-in user sets their own User.checklistDeliveryEmail.
 * Empty = fall back to that user’s login email.
 */

export async function GET() {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: access.userId },
    select: { email: true, checklistDeliveryEmail: true },
  });
  const resolved = resolveChecklistDeliveryTo({
    checklistDeliveryEmail: user?.checklistDeliveryEmail,
    loginEmail: user?.email,
  });
  const override = user?.checklistDeliveryEmail?.trim() || null;
  return NextResponse.json({
    email: "to" in resolved ? resolved.to : null,
    loginEmail: user?.email?.trim() || null,
    usingLoginEmail: !override && "to" in resolved,
    outboundEmailConfigured: outboundEmailConfigured(),
  });
}

export async function PATCH(req: Request) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as { email?: unknown };
    const parsed = normalizeChecklistDeliveryEmail(body.email);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { email: true },
    });
    const login = existing?.email?.trim() || null;
    const sameAsLogin =
      parsed.email != null &&
      login != null &&
      parsed.email.toLowerCase() === login.toLowerCase();
    const stored = sameAsLogin ? null : parsed.email;
    const user = await prisma.user.update({
      where: { id: access.userId },
      data: { checklistDeliveryEmail: stored },
      select: { email: true, checklistDeliveryEmail: true },
    });
    const resolved = resolveChecklistDeliveryTo({
      checklistDeliveryEmail: user.checklistDeliveryEmail,
      loginEmail: user.email,
    });
    const override = user.checklistDeliveryEmail?.trim() || null;
    return NextResponse.json({
      email: "to" in resolved ? resolved.to : parsed.email,
      loginEmail: user.email?.trim() || null,
      usingLoginEmail: !override && "to" in resolved,
      outboundEmailConfigured: outboundEmailConfigured(),
    });
  } catch (e) {
    console.error("[settings/checklist-delivery]", e);
    return NextResponse.json({ error: "Failed to save checklist PDF email" }, { status: 500 });
  }
}
