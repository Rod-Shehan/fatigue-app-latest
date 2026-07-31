import { NextResponse } from "next/server";
import { getSessionForSheetAccess, canAccessSheet, getManagerSession } from "@/lib/auth";
import { getSystemPolicy, sheetWritesBlocked } from "@/lib/system-policy";
import { prisma } from "@/lib/prisma";
import { normalizeSheetDaysForApi } from "@/lib/coverage/derive-minute-coverage";
import {
  appendChecklistToDay,
  validateCompletedChecklistRecord,
  type DayWithChecklists,
} from "@/lib/checklist";

function parseDays(daysJson: string): unknown[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * POST — append a completed checklist record to one day of a sheet.
 * Body: { day_index: 0–6, record: ChecklistRecord }
 */
export async function POST(
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

    const manager = await getManagerSession();
    const isManager = !!manager;
    const driverLocked = !!sheet.signature || sheet.status === "completed";
    if (!isManager && driverLocked) {
      return NextResponse.json(
        {
          error:
            "This record is signed and locked. Ask your manager to amend it if something needs correcting.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const dayIndex = Number(body.day_index ?? body.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
      return NextResponse.json({ error: "day_index must be 0–6" }, { status: 400 });
    }

    const validated = validateCompletedChecklistRecord(body.record);
    if (!validated.ok) {
      return NextResponse.json(
        { error: "Invalid checklist record", details: validated.errors },
        { status: 400 }
      );
    }

    const days = parseDays(sheet.days);
    while (days.length < 7) days.push({});
    const day = (days[dayIndex] && typeof days[dayIndex] === "object"
      ? days[dayIndex]
      : {}) as DayWithChecklists;
    days[dayIndex] = appendChecklistToDay(day, validated.record);

    const normalized = normalizeSheetDaysForApi(days);
    const updated = await prisma.fatigueSheet.update({
      where: { id },
      data: { days: JSON.stringify(normalized) },
    });

    await prisma.auditEvent.create({
      data: {
        sheetId: id,
        actorId: access.userId,
        action: "checklist_completed",
        payload: {
          day_index: dayIndex,
          checklist_id: validated.record.id,
          checklist_type: validated.record.type,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      day_index: dayIndex,
      record: validated.record,
      days: normalizeSheetDaysForApi(parseDays(updated.days)),
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * GET — list completed checklists for a sheet (all days).
 */
export async function GET(
  _req: Request,
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

    const days = normalizeSheetDaysForApi(parseDays(sheet.days)) as Array<
      DayWithChecklists & { date?: unknown }
    >;
    const byDay = days.map((day, day_index) => ({
      day_index,
      date: typeof day?.date === "string" ? day.date : null,
      checklists: Array.isArray(day?.checklists) ? day.checklists : [],
      ticks: {
        fitness_for_work: day?.fitness_for_work === true,
        dimension_load_checklist: day?.dimension_load_checklist === true,
        daily_vehicle_checklist: day?.daily_vehicle_checklist === true,
      },
    }));

    return NextResponse.json({ sheet_id: id, days: byDay });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
