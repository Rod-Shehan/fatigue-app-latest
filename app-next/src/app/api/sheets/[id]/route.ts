import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet, getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoCloseStaleDraftSheetsForUser } from "@/lib/sheet-auto-close-db";
import { getPreviousWeekSunday, isNextWeekOrLater } from "@/lib/weeks";
import { parseJurisdictionCode } from "@/lib/jurisdiction";
import { normalizeSheetDaysForApi } from "@/lib/coverage/derive-minute-coverage";

function parseDays(daysJson: string): unknown[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sheetToJson(row: {
  id: string;
  jurisdictionCode: string;
  driverName: string;
  secondDriver: string | null;
  driverType: string;
  destination: string | null;
  last24hBreak: string | null;
  weekStarting: string;
  days: string;
  status: string;
  signature: string | null;
  signedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    jurisdiction_code: parseJurisdictionCode(row.jurisdictionCode),
    driver_name: row.driverName,
    second_driver: row.secondDriver,
    driver_type: row.driverType,
    destination: row.destination,
    last_24h_break: row.last24hBreak,
    week_starting: row.weekStarting,
    days: normalizeSheetDaysForApi(parseDays(row.days)),
    status: row.status,
    signature: row.signature,
    signed_at: row.signedAt?.toISOString() ?? null,
    created_by: row.createdById,
    created_date: row.createdAt.toISOString(),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    let sheet = await prisma.fatigueSheet.findUnique({ where: { id } });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessSheet(sheet, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (sheet.createdById === access.userId) {
      await autoCloseStaleDraftSheetsForUser(access.userId);
      sheet = await prisma.fatigueSheet.findUnique({ where: { id } });
      if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(sheetToJson(sheet));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const sheet = await prisma.fatigueSheet.findUnique({ where: { id } });
    if (!sheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!canAccessSheet(sheet, access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const {
      driver_name,
      second_driver,
      driver_type,
      destination,
      last_24h_break,
      week_starting,
      days,
      status,
      signature,
      signed_at,
      amendment_reason,
      jurisdiction_code,
      jurisdictionCode,
    } = body;

    // Lock after completion/signature:
    // - Drivers cannot edit completed sheets.
    // - Managers can amend completed sheets with an explicit reason; amendment clears signature and reopens as draft.
    const isCompleted = sheet.status === "completed";
    const manager = await getManagerSession();
    const isManager = !!manager;
    const isAmendment = typeof amendment_reason === "string" && amendment_reason.trim().length > 0;
    if (isCompleted && !isManager) {
      return NextResponse.json(
        { error: "This sheet is completed and locked. A manager must create an amendment to make changes." },
        { status: 409 }
      );
    }
    if (isCompleted && isManager && !isAmendment) {
      return NextResponse.json(
        { error: "Amendment reason is required to edit a completed sheet.", code: "AMENDMENT_REASON_REQUIRED" },
        { status: 400 }
      );
    }

    if (week_starting !== undefined && isNextWeekOrLater(week_starting)) {
      const current = await prisma.fatigueSheet.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const driverName = (driver_name !== undefined ? driver_name : current.driverName)?.trim() || "";
      if (!driverName || driverName === "Draft") {
        return NextResponse.json(
          { error: "Set the driver name before moving this sheet to next week." },
          { status: 400 }
        );
      }
      const previousWeekSunday = getPreviousWeekSunday(week_starting);
      const prevSheet = await prisma.fatigueSheet.findFirst({
        where: {
          driverName,
          weekStarting: previousWeekSunday,
        },
      });
      if (!prevSheet || prevSheet.status !== "completed") {
        return NextResponse.json(
          {
            error: `Complete and sign the sheet for the week of ${previousWeekSunday} before starting the next week.`,
            code: "PREVIOUS_WEEK_INCOMPLETE",
            week_starting: previousWeekSunday,
            sheet_id: prevSheet?.id,
          },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (jurisdiction_code !== undefined || jurisdictionCode !== undefined) {
      data.jurisdictionCode = parseJurisdictionCode(jurisdictionCode ?? jurisdiction_code);
    }
    if (driver_name !== undefined) data.driverName = driver_name;
    if (second_driver !== undefined) data.secondDriver = second_driver;
    if (driver_type !== undefined) data.driverType = driver_type;
    if (destination !== undefined) data.destination = destination;
    if (last_24h_break !== undefined) data.last24hBreak = last_24h_break || null;
    if (week_starting !== undefined) data.weekStarting = week_starting;
    if (days !== undefined) data.days = JSON.stringify(normalizeSheetDaysForApi(days));
    if (status !== undefined) data.status = status;
    if (signature !== undefined) data.signature = signature;
    if (signed_at !== undefined) data.signedAt = signed_at ? new Date(signed_at) : null;

    const changeKeys = Object.keys(data);

    // For manager amendments on completed sheets: reopen and clear signature so it can be re-signed.
    if (isCompleted && isManager && isAmendment) {
      data.status = "draft";
      data.signature = null;
      data.signedAt = null;
      if (!changeKeys.includes("status")) changeKeys.push("status");
      if (!changeKeys.includes("signature")) changeKeys.push("signature");
      if (!changeKeys.includes("signedAt")) changeKeys.push("signedAt");
    }
    const updated = await prisma.fatigueSheet.update({
      where: { id },
      data: data as Parameters<typeof prisma.fatigueSheet.update>[0]["data"],
    });

    // Append-only audit entry.
    await prisma.auditEvent.create({
      data: {
        sheetId: id,
        actorId: access.userId,
        action: isCompleted && isManager && isAmendment
          ? "amend_sheet"
          : status === "completed" || signature !== undefined || signed_at !== undefined
              ? "complete_sheet"
              : "update_sheet",
        payload: {
          changed_fields: changeKeys,
          amendment_reason: isCompleted && isManager && isAmendment ? amendment_reason.trim() : undefined,
          status_before: sheet.status,
          status_after: updated.status,
          had_signature_before: !!sheet.signature,
          has_signature_after: !!updated.signature,
        },
      },
    });

    return NextResponse.json(sheetToJson(updated));
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const manager = await getManagerSession();
    if (!manager) return NextResponse.json({ error: "Manager access required" }, { status: 403 });
    const { id } = await params;
    await prisma.fatigueSheet.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
