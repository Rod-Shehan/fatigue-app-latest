import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureSystemPolicyRow, getSystemPolicy } from "@/lib/system-policy";
import {
  maintenanceContactEmailReady,
  maintenanceContactFromPolicy,
} from "@/lib/maintenance-contact";
import { sendMaintenanceFaultReportEmail } from "@/lib/email/outbound";

/**
 * POST /api/settings/maintenance-fault-report
 * Send actioned Prestart fault text to the org workshop contact (WAHVA trail).
 * Body: { faultText: string, driverName?: string, sheetDayLabel?: string }
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const faultText = typeof body.faultText === "string" ? body.faultText.trim() : "";
    if (!faultText) {
      return NextResponse.json({ error: "faultText is required" }, { status: 400 });
    }

    await ensureSystemPolicyRow();
    const contact = maintenanceContactFromPolicy(await getSystemPolicy());
    if (!maintenanceContactEmailReady(contact)) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_contact",
          message:
            "No workshop email in Settings. Add a workshop contact, then report the fault again.",
        },
        { status: 422 }
      );
    }

    const driverName =
      typeof body.driverName === "string" && body.driverName.trim()
        ? body.driverName.trim()
        : (session?.user as { name?: string | null } | undefined)?.name?.trim() || "Driver";
    const dayLabel =
      typeof body.sheetDayLabel === "string" && body.sheetDayLabel.trim()
        ? body.sheetDayLabel.trim()
        : null;

    const subject = dayLabel
      ? `Prestart fault report — ${driverName} — ${dayLabel}`
      : `Prestart fault report — ${driverName}`;

    const result = await sendMaintenanceFaultReportEmail({
      toEmail: contact.email!,
      contactName: contact.name,
      contactCompany: contact.company,
      subject,
      body: [
        `Driver: ${driverName}`,
        dayLabel ? `Day: ${dayLabel}` : null,
        contact.phone ? `Workshop phone on file: ${contact.phone}` : null,
        "",
        "Actioned fault:",
        faultText,
      ]
        .filter((l) => l !== null)
        .join("\n"),
      replyTo: (session?.user as { email?: string | null } | undefined)?.email ?? undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, message: result.message },
        { status: result.reason === "not_configured" ? 503 : 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      provider: result.provider,
      id: result.id ?? null,
      to: contact.email,
    });
  } catch (e) {
    console.error("maintenance-fault-report POST error:", e);
    return NextResponse.json({ error: "Failed to send fault report" }, { status: 500 });
  }
}
