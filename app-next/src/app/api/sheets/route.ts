import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getThisWeekSunday, isNextWeekOrLater } from "@/lib/weeks";
import { parseJurisdictionCode } from "@/lib/jurisdiction";

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
    days: parseDays(row.days),
    status: row.status,
    signature: row.signature,
    signed_at: row.signedAt?.toISOString() ?? null,
    created_by: row.createdById,
    created_date: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const where = access.isManager
      ? {}
      : { createdById: access.userId };
    const sheets = await prisma.fatigueSheet.findMany({
      where,
      orderBy: { weekStarting: "desc" },
      take: 50,
    });
    const list = sheets.map((s) => sheetToJson(s));
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Limit: only one unfinished (draft) sheet per driver at a time.
    // Prevent multiple live sheets that can be edited concurrently.
    const existingDraft = await prisma.fatigueSheet.findFirst({
      where: {
        createdById: access.userId,
        status: { not: "completed" },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, weekStarting: true, status: true },
    });
    if (existingDraft) {
      return NextResponse.json(
        {
          error: "You already have an unfinished sheet. Complete and sign it before starting a new one.",
          code: "UNFINISHED_SHEET_EXISTS",
          sheet_id: existingDraft.id,
          week_starting: existingDraft.weekStarting,
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
        weekStarting: week_starting,
        days: JSON.stringify(days),
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
