import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildChecklistPackJsPdfBuffer,
  collectChecklistPdfDays,
} from "@/lib/checklist/checklist-pdf";
import {
  CHECKLIST_ARCHIVE_EMAIL,
} from "@/lib/checklist/checklist-email";
import type { ChecklistRecord } from "@/lib/checklist";
import { outboundEmailConfigured, sendOutboundEmail } from "@/lib/email/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — build checklist PDF and email to Circadia holding inbox (interim custody).
 * Body optional: { dayIndex?: 0–6 }
 * Later: per-client distribution replaces / extends this destination.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!outboundEmailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        reason: "not_configured",
        message: "Outbound email is not configured. Set RESEND_API_KEY + EMAIL_FROM.",
      },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const row = await prisma.fatigueSheet.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    if (!canAccessSheet(row, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let days: Array<{ checklists?: ChecklistRecord[] }> = [];
    try {
      const parsed = row.days ? JSON.parse(row.days) : [];
      days = Array.isArray(parsed) ? parsed : [];
    } catch {
      days = [];
    }

    let dayIndex: number | null = null;
    try {
      const body = (await req.json().catch(() => ({}))) as { dayIndex?: unknown; day_index?: unknown };
      const raw = body.dayIndex ?? body.day_index;
      if (raw != null && raw !== "") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0 || n > 6) {
          return NextResponse.json({ error: "dayIndex must be 0–6" }, { status: 400 });
        }
        dayIndex = n;
      }
    } catch {
      /* empty body ok */
    }

    const bundles = collectChecklistPdfDays({
      weekStarting: row.weekStarting,
      days,
      dayIndex,
    });

    if (!bundles.length) {
      return NextResponse.json(
        { error: "No completed checklist records for this selection" },
        { status: 404 }
      );
    }

    const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });
    const pdfBytes = await buildChecklistPackJsPdfBuffer({
      driverName: row.driverName,
      weekStarting: row.weekStarting,
      days: bundles,
      generatedAtLabel,
    });

    const safeName = (row.driverName || "driver").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const daySuffix = dayIndex != null ? `-day${dayIndex}` : "-week";
    const filename = `checklist-pack-${safeName}-${row.weekStarting}${daySuffix}.pdf`;

    const subject =
      dayIndex != null
        ? `Checklist pack — ${row.driverName} — day ${dayIndex} — ${row.weekStarting}`
        : `Checklist pack — ${row.driverName} — week ${row.weekStarting}`;

    const result = await sendOutboundEmail({
      to: CHECKLIST_ARCHIVE_EMAIL,
      subject,
      text: [
        "Circadia24 checklist pack (holding copy).",
        "",
        `Driver: ${row.driverName}`,
        `Week starting: ${row.weekStarting}`,
        dayIndex != null ? `Day index: ${dayIndex}` : "Scope: full week with completed checklists",
        `Sheet id: ${id}`,
        `Generated (AWST): ${generatedAtLabel}`,
        "",
        "This is not the 28-day fatigue roadside PDF.",
        "Structured answers remain in Circadia (Neon). Per-client email distribution comes later.",
      ].join("\n"),
      attachments: [
        {
          filename,
          content: pdfBytes,
          contentType: "application/pdf",
        },
      ],
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, message: result.message },
        { status: result.reason === "not_configured" ? 503 : 502 }
      );
    }

    await prisma.auditEvent.create({
      data: {
        sheetId: id,
        actorId: access.userId,
        action: "checklist_pdf_emailed",
        payload: {
          to: CHECKLIST_ARCHIVE_EMAIL,
          day_index: dayIndex,
          filename,
          resend_id: result.id ?? null,
        },
      },
    }).catch(() => {
      /* audit best-effort */
    });

    return NextResponse.json({
      ok: true,
      to: CHECKLIST_ARCHIVE_EMAIL,
      filename,
      id: result.id,
    });
  } catch (e) {
    console.error("[checklists/export/email]", e);
    return NextResponse.json({ error: "Failed to email checklist PDF" }, { status: 500 });
  }
}
