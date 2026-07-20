import { NextRequest, NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import { getSystemPolicy, sheetWritesBlocked } from "@/lib/system-policy";
import { prisma } from "@/lib/prisma";
import { autoCloseStaleDraftSheetsForUser } from "@/lib/sheet-auto-close-db";
import { getThisWeekSunday, isNextWeekOrLater } from "@/lib/weeks";
import { parseJurisdictionCode } from "@/lib/jurisdiction";
import { normalizeSheetDaysForApi } from "@/lib/coverage/derive-minute-coverage";
import { reopenPrematureCurrentWeekAttestationIfNeeded } from "@/lib/sheet-premature-attestation-db";

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
  last24hRest1: string | null;
  last24hRest2: string | null;
  last24hRest3: string | null;
  last24hRest4: string | null;
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
    last_24h_rest_1: row.last24hRest1,
    last_24h_rest_2: row.last24hRest2,
    last_24h_rest_3: row.last24hRest3,
    last_24h_rest_4: row.last24hRest4,
    week_starting: row.weekStarting,
    days: normalizeSheetDaysForApi(parseDays(row.days)),
    status: row.status,
    signature: row.signature,
    signed_at: row.signedAt?.toISOString() ?? null,
    created_by: row.createdById,
    created_date: row.createdAt.toISOString(),
  };
}

function sheetToJsonMeta(row: {
  id: string;
  jurisdictionCode: string;
  driverName: string;
  secondDriver: string | null;
  driverType: string;
  destination: string | null;
  last24hBreak: string | null;
  last24hRest1: string | null;
  last24hRest2: string | null;
  last24hRest3: string | null;
  last24hRest4: string | null;
  weekStarting: string;
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
    last_24h_rest_1: row.last24hRest1,
    last_24h_rest_2: row.last24hRest2,
    last_24h_rest_3: row.last24hRest3,
    last_24h_rest_4: row.last24hRest4,
    week_starting: row.weekStarting,
    days: [] as ReturnType<typeof normalizeSheetDaysForApi>,
    status: row.status,
    signature: row.signature,
    signed_at: row.signedAt?.toISOString() ?? null,
    created_by: row.createdById,
    created_date: row.createdAt.toISOString(),
  };
}

const sheetMetaSelect = {
  id: true,
  jurisdictionCode: true,
  driverName: true,
  secondDriver: true,
  driverType: true,
  destination: true,
  last24hBreak: true,
  last24hRest1: true,
  last24hRest2: true,
  last24hRest3: true,
  last24hRest4: true,
  weekStarting: true,
  status: true,
  signature: true,
  signedAt: true,
  createdById: true,
  createdAt: true,
} as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weekStarting = searchParams.get("weekStarting")?.trim();
  const metaOnly = searchParams.get("meta") === "1";
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!access.isManager) {
      await autoCloseStaleDraftSheetsForUser(access.userId);
    }
    const where = {
      ...(access.isManager ? {} : { createdById: access.userId }),
      ...(weekStarting ? { weekStarting } : {}),
    };
    if (metaOnly) {
      const rows = await prisma.fatigueSheet.findMany({
        where,
        orderBy: { weekStarting: "desc" },
        ...(access.isManager ? {} : { take: 50 }),
        select: sheetMetaSelect,
      });
      return NextResponse.json(rows.map((s) => sheetToJsonMeta(s)));
    }
    let sheets = await prisma.fatigueSheet.findMany({
      where,
      orderBy: { weekStarting: "desc" },
      ...(access.isManager ? {} : { take: 50 }),
    });
    sheets = await Promise.all(
      sheets.map((s) => reopenPrematureCurrentWeekAttestationIfNeeded(prisma, s, access.userId))
    );
    const list = sheets.map((s) => sheetToJson(s));
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const writeBlock = sheetWritesBlocked(await getSystemPolicy(), {
    isManager: access.isManager,
    isOwner: access.isOwner,
  });
  if (writeBlock) return NextResponse.json({ error: writeBlock, code: "WRITES_DISABLED" }, { status: 403 });
  try {
    await autoCloseStaleDraftSheetsForUser(access.userId);

    // Limit: only one unfinished (draft) sheet per driver at a time.
    // Prevent multiple live sheets that can be edited concurrently.
    const thisWeekSunday = getThisWeekSunday();
    const existingCurrentWeekDraft = await prisma.fatigueSheet.findFirst({
      where: {
        createdById: access.userId,
        status: { not: "completed" },
        weekStarting: thisWeekSunday,
      },
      select: { id: true, weekStarting: true, status: true },
    });
    if (existingCurrentWeekDraft) {
      return NextResponse.json(
        {
          error: "You already have an open sheet for this week. Open it to continue logging.",
          code: "UNFINISHED_SHEET_EXISTS",
          sheet_id: existingCurrentWeekDraft.id,
          week_starting: existingCurrentWeekDraft.weekStarting,
        },
        { status: 409 }
      );
    }

    const body = await req.json();
    const {
      driver_name,
      second_driver,
      driver_type,
      destination,
      week_starting,
      days,
      status,
      signature,
      signed_at,
      jurisdiction_code,
      jurisdictionCode,
    } = body;
    if (!week_starting || !Array.isArray(days)) {
      return NextResponse.json(
        { error: "week_starting and days required" },
        { status: 400 }
      );
    }

    const driverName = (driver_name ?? "").trim() || "Draft";
    if (isNextWeekOrLater(week_starting)) {
      if (!driverName || driverName === "Draft") {
        return NextResponse.json(
          { error: "Set the driver name before creating a sheet for next week." },
          { status: 400 }
        );
      }
      const thisWeekSunday = getThisWeekSunday();
      const thisWeekSheet = await prisma.fatigueSheet.findFirst({
        where: {
          weekStarting: thisWeekSunday,
          driverName,
        },
      });
      if (!thisWeekSheet) {
        return NextResponse.json(
          {
            error: `Complete and sign the sheet for the week of ${thisWeekSunday} before starting the next week.`,
            code: "PREVIOUS_WEEK_INCOMPLETE",
            week_starting: thisWeekSunday,
          },
          { status: 400 }
        );
      }
      if (thisWeekSheet.status !== "completed") {
        return NextResponse.json(
          {
            error: `Complete and sign the sheet for the week of ${thisWeekSunday} before starting the next week.`,
            code: "PREVIOUS_WEEK_INCOMPLETE",
            week_starting: thisWeekSunday,
            sheet_id: thisWeekSheet.id,
          },
          { status: 400 }
        );
      }
    }

    const sheet = await prisma.fatigueSheet.create({
      data: {
        jurisdictionCode: parseJurisdictionCode(jurisdictionCode ?? jurisdiction_code),
        driverName,
        secondDriver: second_driver ?? null,
        driverType: driver_type ?? "solo",
        destination: destination ?? null,
        last24hBreak: body.last_24h_break ?? null,
        last24hRest1: body.last_24h_rest_1 ?? null,
        last24hRest2: body.last_24h_rest_2 ?? null,
        last24hRest3: body.last_24h_rest_3 ?? null,
        last24hRest4: body.last_24h_rest_4 ?? null,
        weekStarting: week_starting,
        days: JSON.stringify(normalizeSheetDaysForApi(days)),
        status: status ?? "draft",
        signature: signature ?? null,
        signedAt: signed_at ? new Date(signed_at) : null,
        createdById: access.userId,
      },
    });

    await prisma.auditEvent.create({
      data: {
        sheetId: sheet.id,
        actorId: access.userId,
        action: "create_sheet",
        payload: {
          week_starting: sheet.weekStarting,
          driver_name: sheet.driverName,
          driver_type: sheet.driverType,
        },
      },
    });
    return NextResponse.json(sheetToJson(sheet));
  } catch (e) {
    console.error("Sheet create error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create sheet" },
      { status: 500 }
    );
  }
}
