import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildChecklistPackJsPdfBuffer,
  checklistPdfFilename,
  collectChecklistPdfDays,
  CHECKLIST_PDF_TYPES,
  CHECKLIST_PDF_TYPE_TITLE,
} from "@/lib/checklist/checklist-pdf";
import { resolveChecklistDeliveryTo } from "@/lib/checklist/checklist-email";
import {
  isChecklistRecordType,
  type ChecklistRecord,
  type ChecklistRecordType,
} from "@/lib/checklist";
import { outboundEmailConfigured, sendOutboundEmail } from "@/lib/email/outbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — email week pack PDF(s) by checklist type to the signed-in user’s address.
 * Body: { type?: ffw|prestart|dimension_load } — omit type to attach one PDF per type that has records.
 * Types are never merged into one PDF (different regs / audit call-ups).
 * Fatigue roadside PDF is never included.
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

    let onlyType: ChecklistRecordType | null = null;
    try {
      const body = (await req.json().catch(() => ({}))) as { type?: unknown };
      if (body.type != null && body.type !== "") {
        if (!isChecklistRecordType(body.type)) {
          return NextResponse.json(
            { error: "type must be ffw | prestart | dimension_load" },
            { status: 400 }
          );
        }
        onlyType = body.type;
      }
    } catch {
      /* empty body = all types */
    }

    const types: ChecklistRecordType[] = onlyType ? [onlyType] : [...CHECKLIST_PDF_TYPES];
    const generatedAtLabel = new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" });
    const attachments: { filename: string; content: Buffer | Uint8Array; contentType: string }[] =
      [];
    const included: string[] = [];

    for (const type of types) {
      const bundles = collectChecklistPdfDays({
        weekStarting: row.weekStarting,
        days,
        type,
        dayIndex: null,
      });
      if (!bundles.length) continue;
      const pdfBytes = await buildChecklistPackJsPdfBuffer({
        driverName: row.driverName,
        weekStarting: row.weekStarting,
        days: bundles,
        generatedAtLabel,
        type,
      });
      const filename = checklistPdfFilename({
        driverName: row.driverName,
        weekStarting: row.weekStarting,
        type,
        dayIndex: null,
      });
      attachments.push({
        filename,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      });
      included.push(CHECKLIST_PDF_TYPE_TITLE[type]);
    }

    if (!attachments.length) {
      return NextResponse.json(
        { error: "No completed checklist records for this week" },
        { status: 404 }
      );
    }

    const subject = onlyType
      ? `${CHECKLIST_PDF_TYPE_TITLE[onlyType]} week pack — ${row.driverName} — ${row.weekStarting}`
      : `Checklist week packs — ${row.driverName} — ${row.weekStarting}`;

    const sender = await prisma.user.findUnique({
      where: { id: access.userId },
      select: { email: true, checklistDeliveryEmail: true },
    });
    const resolved = resolveChecklistDeliveryTo({
      checklistDeliveryEmail: sender?.checklistDeliveryEmail,
      loginEmail: sender?.email,
    });
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    const to = resolved.to;

    const result = await sendOutboundEmail({
      to,
      subject,
      text: [
        "Circadia24 checklist week pack(s).",
        "",
        `Driver: ${row.driverName}`,
        `Week starting: ${row.weekStarting}`,
        `Included (separate PDF per type): ${included.join("; ")}`,
        `Generated (AWST): ${generatedAtLabel}`,
        "",
        "Types are not combined — auditors often call up each form type separately.",
      ].join("\n"),
      attachments,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, message: result.message },
        { status: result.reason === "not_configured" ? 503 : 502 }
      );
    }

    await prisma.auditEvent
      .create({
        data: {
          sheetId: id,
          actorId: access.userId,
          action: "checklist_pdf_emailed",
          payload: {
            to,
            types: onlyType ? [onlyType] : included,
            filenames: attachments.map((a) => a.filename),
            resend_id: result.id ?? null,
          },
        },
      })
      .catch(() => {
        /* audit best-effort */
      });

    return NextResponse.json({
      ok: true,
      to,
      filenames: attachments.map((a) => a.filename),
      id: result.id,
    });
  } catch (e) {
    console.error("[checklists/export/email]", e);
    return NextResponse.json({ error: "Failed to email checklist PDF" }, { status: 500 });
  }
}
