import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet, getManagerSession } from "@/lib/auth";
import { getSystemPolicy, sheetWritesBlocked } from "@/lib/system-policy";
import { prisma } from "@/lib/prisma";
import { autoCloseStaleDraftSheetsForUser } from "@/lib/sheet-auto-close-db";
import { getPreviousWeekSunday, isNextWeekOrLater, isPastRegulatoryWeek } from "@/lib/weeks";
import { parseJurisdictionCode } from "@/lib/jurisdiction";
import { normalizeSheetDaysForApi } from "@/lib/coverage/derive-minute-coverage";
import { applyDerivedTripTicksToDays } from "@/lib/checklist/derive-trip-ticks";
import {
  managerRequiresAmendmentReason,
  patchIsAttestationOnly,
  patchTouchesContent,
  sheetIsUnsignedForDriver,
} from "@/lib/sheet-record";
import { DRIVER_SIGN_WEEK_NOT_ENDED_ERROR } from "@/lib/product-copy";
import { reopenPrematureCurrentWeekAttestationIfNeeded } from "@/lib/sheet-premature-attestation-db";
import {
  enqueueFrmsRecompute,
  isFrmsEngineEnabled,
  loadDriverWeekMap,
  resolveFrmsProspectiveRegister,
} from "@/lib/frms/orchestrator";

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
  last24hBreakStart: Date | null;
  last24hBreakEnd: Date | null;
  last24hRest1: string | null;
  last24hRest2: string | null;
  last24hRest3: string | null;
  last24hRest4: string | null;
  last24hRest1Start: Date | null;
  last24hRest1End: Date | null;
  last24hRest2Start: Date | null;
  last24hRest2End: Date | null;
  last24hRest3Start: Date | null;
  last24hRest3End: Date | null;
  last24hRest4Start: Date | null;
  last24hRest4End: Date | null;
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
    last_24h_break_start: row.last24hBreakStart?.toISOString() ?? null,
    last_24h_break_end: row.last24hBreakEnd?.toISOString() ?? null,
    last_24h_rest_1: row.last24hRest1,
    last_24h_rest_2: row.last24hRest2,
    last_24h_rest_3: row.last24hRest3,
    last_24h_rest_4: row.last24hRest4,
    last_24h_rest_1_start: row.last24hRest1Start?.toISOString() ?? null,
    last_24h_rest_1_end: row.last24hRest1End?.toISOString() ?? null,
    last_24h_rest_2_start: row.last24hRest2Start?.toISOString() ?? null,
    last_24h_rest_2_end: row.last24hRest2End?.toISOString() ?? null,
    last_24h_rest_3_start: row.last24hRest3Start?.toISOString() ?? null,
    last_24h_rest_3_end: row.last24hRest3End?.toISOString() ?? null,
    last_24h_rest_4_start: row.last24hRest4Start?.toISOString() ?? null,
    last_24h_rest_4_end: row.last24hRest4End?.toISOString() ?? null,
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

    sheet = await reopenPrematureCurrentWeekAttestationIfNeeded(prisma, sheet, access.userId);

    const body = sheetToJson(sheet) as ReturnType<typeof sheetToJson> & {
      risk_register?: unknown;
      frms_cache_status?: string;
      frms_run_id?: string | null;
    };

    if (isFrmsEngineEnabled()) {
      const weekMap = await loadDriverWeekMap(prisma, sheet.driverName);
      const frms = await resolveFrmsProspectiveRegister(prisma, {
        driverName: sheet.driverName,
        weekStarting: sheet.weekStarting,
        weekMap,
        jurisdictionCode: sheet.jurisdictionCode,
        driverType: sheet.driverType,
        userId: sheet.createdById ?? access.userId,
      });
      if (frms.register) body.risk_register = frms.register;
      body.frms_cache_status = frms.cacheStatus;
      body.frms_run_id = frms.runId;
    }

    return NextResponse.json(body);
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
    const writeBlock = sheetWritesBlocked(await getSystemPolicy(), {
      isManager: access.isManager,
      isOwner: access.isOwner,
    });
    if (writeBlock) {
      return NextResponse.json({ error: writeBlock, code: "WRITES_DISABLED" }, { status: 403 });
    }
    const body = await req.json();
    const {
      driver_name,
      second_driver,
      driver_type,
      destination,
      last_24h_break,
      last_24h_break_start,
      last_24h_break_end,
      last_24h_rest_1,
      last_24h_rest_2,
      last_24h_rest_3,
      last_24h_rest_4,
      last_24h_rest_1_start,
      last_24h_rest_1_end,
      last_24h_rest_2_start,
      last_24h_rest_2_end,
      last_24h_rest_3_start,
      last_24h_rest_3_end,
      last_24h_rest_4_start,
      last_24h_rest_4_end,
      week_starting,
      days,
      status,
      signature,
      signed_at,
      amendment_reason,
      jurisdiction_code,
      jurisdictionCode,
    } = body;

    const isCompleted = sheet.status === "completed";
    const isPastWeek = isPastRegulatoryWeek(sheet.weekStarting);
    const manager = await getManagerSession();
    const isManager = !!manager;
    const isAmendment = typeof amendment_reason === "string" && amendment_reason.trim().length > 0;
    const bodyRecord = body as Record<string, unknown>;
    const touchesContent = patchTouchesContent(bodyRecord);
    const attestationOnly = patchIsAttestationOnly(bodyRecord);

    if (!isManager) {
      const driverLocked = !!sheet.signature || sheet.status === "completed";
      if (touchesContent && driverLocked) {
        return NextResponse.json(
          {
            error:
              "This record is signed and locked. Ask your manager to amend it if something needs correcting.",
            code: "SHEET_SIGNED_LOCKED",
          },
          { status: 409 }
        );
      }
      if (attestationOnly && status === "completed" && !signature) {
        return NextResponse.json(
          { error: "A signature is required to complete this record.", code: "SIGNATURE_REQUIRED" },
          { status: 400 }
        );
      }
      const attemptingSign =
        status === "completed" ||
        (signature !== undefined && signature !== null && String(signature).trim() !== "");
      if (
        attemptingSign &&
        sheetIsUnsignedForDriver(sheet.status, sheet.signature) &&
        !isPastRegulatoryWeek(sheet.weekStarting)
      ) {
        return NextResponse.json(
          { error: DRIVER_SIGN_WEEK_NOT_ENDED_ERROR, code: "WEEK_NOT_ENDED" },
          { status: 400 }
        );
      }
    }

    if (
      isManager &&
      touchesContent &&
      managerRequiresAmendmentReason(sheet.weekStarting, sheet.status, bodyRecord)
    ) {
      if (!isAmendment) {
        return NextResponse.json(
          {
            error: "Amendment reason is required to edit a past or completed sheet.",
            code: "AMENDMENT_REASON_REQUIRED",
          },
          { status: 400 }
        );
      }
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
    if (last_24h_break_start !== undefined) {
      data.last24hBreakStart = last_24h_break_start ? new Date(last_24h_break_start) : null;
    }
    if (last_24h_break_end !== undefined) {
      data.last24hBreakEnd = last_24h_break_end ? new Date(last_24h_break_end) : null;
    }
    if (last_24h_rest_1 !== undefined) data.last24hRest1 = last_24h_rest_1 || null;
    if (last_24h_rest_2 !== undefined) data.last24hRest2 = last_24h_rest_2 || null;
    if (last_24h_rest_3 !== undefined) data.last24hRest3 = last_24h_rest_3 || null;
    if (last_24h_rest_4 !== undefined) data.last24hRest4 = last_24h_rest_4 || null;
    if (last_24h_rest_1_start !== undefined) {
      data.last24hRest1Start = last_24h_rest_1_start ? new Date(last_24h_rest_1_start) : null;
    }
    if (last_24h_rest_1_end !== undefined) {
      data.last24hRest1End = last_24h_rest_1_end ? new Date(last_24h_rest_1_end) : null;
    }
    if (last_24h_rest_2_start !== undefined) {
      data.last24hRest2Start = last_24h_rest_2_start ? new Date(last_24h_rest_2_start) : null;
    }
    if (last_24h_rest_2_end !== undefined) {
      data.last24hRest2End = last_24h_rest_2_end ? new Date(last_24h_rest_2_end) : null;
    }
    if (last_24h_rest_3_start !== undefined) {
      data.last24hRest3Start = last_24h_rest_3_start ? new Date(last_24h_rest_3_start) : null;
    }
    if (last_24h_rest_3_end !== undefined) {
      data.last24hRest3End = last_24h_rest_3_end ? new Date(last_24h_rest_3_end) : null;
    }
    if (last_24h_rest_4_start !== undefined) {
      data.last24hRest4Start = last_24h_rest_4_start ? new Date(last_24h_rest_4_start) : null;
    }
    if (last_24h_rest_4_end !== undefined) {
      data.last24hRest4End = last_24h_rest_4_end ? new Date(last_24h_rest_4_end) : null;
    }
    if (week_starting !== undefined) data.weekStarting = week_starting;
    if (days !== undefined) {
      data.days = JSON.stringify(
        normalizeSheetDaysForApi(applyDerivedTripTicksToDays(days))
      );
    }
    if (status !== undefined) data.status = status;
    if (signature !== undefined) data.signature = signature;
    if (signed_at !== undefined) data.signedAt = signed_at ? new Date(signed_at) : null;

    const changeKeys = Object.keys(data);

    // Manager amendment on past/completed: clear attestation so driver must re-sign after corrections.
    if (isManager && isAmendment && (isPastWeek || isCompleted) && sheet.signature) {
      const unlockOnly = !touchesContent;
      if (unlockOnly || touchesContent) {
        data.status = "draft";
        data.signature = null;
        data.signedAt = null;
        if (!changeKeys.includes("status")) changeKeys.push("status");
        if (!changeKeys.includes("signature")) changeKeys.push("signature");
        if (!changeKeys.includes("signedAt")) changeKeys.push("signedAt");
      }
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
        action:
          isManager && isAmendment
            ? "amend_sheet"
            : status === "completed" || signature !== undefined || signed_at !== undefined
              ? "complete_sheet"
              : "update_sheet",
        payload: {
          changed_fields: changeKeys,
          amendment_reason: isManager && isAmendment ? amendment_reason.trim() : undefined,
          status_before: sheet.status,
          status_after: updated.status,
          had_signature_before: !!sheet.signature,
          has_signature_after: !!updated.signature,
        },
      },
    });

    if (isFrmsEngineEnabled() && days !== undefined) {
      enqueueFrmsRecompute({
        driverName: updated.driverName,
        weekStarting: updated.weekStarting,
        userId: updated.createdById ?? access.userId,
      });
    }

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
