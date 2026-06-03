import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getComplianceEngine, parseJurisdictionCode } from "@/lib/jurisdiction";
import type { ComplianceCheckResult } from "@/lib/api";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import {
  buildComplianceWeekContextFromMap,
  parseSheetDaysJson,
} from "@/lib/compliance-history";

export type ManagerComplianceItem = {
  sheetId: string;
  driver_name: string;
  week_starting: string;
  results: ComplianceCheckResult[];
  /** Number of events that have lat/lng (for audit evidence). */
  eventsWithLocation?: number;
  /** Total number of events across all days. */
  totalEvents?: number;
};

/**
 * GET /api/manager/compliance
 * Returns all warnings and violations for every sheet the manager can see (all drivers).
 * Manager-only.
 */
export async function GET() {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sheets = await prisma.fatigueSheet.findMany({
      where: {},
      orderBy: [{ weekStarting: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    const drivers = [...new Set(sheets.map((s) => s.driverName))];
    const driverSheets = drivers.length
      ? await prisma.fatigueSheet.findMany({
          where: { driverName: { in: drivers } },
          select: { driverName: true, weekStarting: true, days: true },
        })
      : [];

    const byDriverWeek = new Map<string, Map<string, { days: string }>>();
    for (const row of driverSheets) {
      if (!byDriverWeek.has(row.driverName)) {
        byDriverWeek.set(row.driverName, new Map());
      }
      byDriverWeek.get(row.driverName)!.set(row.weekStarting, { days: row.days });
    }

    const now = Date.now();
    const today = new Date(now);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const items: ManagerComplianceItem[] = [];
    for (const sheet of sheets) {
      const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(now, sheet.jurisdictionCode);
      const engine = getComplianceEngine(parseJurisdictionCode(sheet.jurisdictionCode));
      const weekMap = byDriverWeek.get(sheet.driverName) ?? new Map<string, { days: string }>();
      const { prevWeekDays, prevWeekStarting, historyDays } = buildComplianceWeekContextFromMap(
        sheet.weekStarting,
        weekMap
      );
      const days = parseSheetDaysJson(sheet.days);

      const [yw, mw, dw] = sheet.weekStarting.split("-").map(Number);
      let currentDayIndex: number | undefined;
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(yw, mw - 1, dw + i);
        const ds = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
        if (ds === todayStr) {
          currentDayIndex = i;
          break;
        }
      }

      const results = engine.run(days, {
        driverType: sheet.driverType ?? "solo",
        prevWeekDays,
        historyDays,
        last24hBreak: sheet.last24hBreak ?? undefined,
        weekStarting: sheet.weekStarting,
        prevWeekStarting,
        currentDayIndex,
        slotOffsetWithinToday,
      });

      let totalEvents = 0;
      let eventsWithLocation = 0;
      days.forEach((d) => {
        (d.events ?? []).forEach((ev) => {
          totalEvents++;
          if (ev.lat != null && ev.lng != null) eventsWithLocation++;
        });
      });

      items.push({
        sheetId: sheet.id,
        driver_name: sheet.driverName,
        week_starting: sheet.weekStarting,
        results,
        eventsWithLocation,
        totalEvents,
      });
    }

    return NextResponse.json({ items });
  } catch (e) {
    console.error("Manager compliance error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
