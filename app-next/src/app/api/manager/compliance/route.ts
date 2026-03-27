import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ComplianceDayData } from "@/lib/compliance";
import { getComplianceEngine, parseJurisdictionCode } from "@/lib/jurisdiction";
import type { ComplianceCheckResult } from "@/lib/api";
import { getPreviousWeekSunday } from "@/lib/weeks";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";

function parseDays(daysJson: string): ComplianceDayData[] {
  try {
    const parsed = JSON.parse(daysJson);
    return Array.isArray(parsed) ? (parsed as ComplianceDayData[]) : [];
  } catch {
    return [];
  }
}

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

    const byDriverWeek = new Map<string, (typeof sheets)[0]>();
    for (const s of sheets) {
      byDriverWeek.set(`${s.driverName}|${s.weekStarting}`, s);
    }

    const now = Date.now();
    const today = new Date(now);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const items: ManagerComplianceItem[] = [];
    for (const sheet of sheets) {
      const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(now, sheet.jurisdictionCode);
      const engine = getComplianceEngine(parseJurisdictionCode(sheet.jurisdictionCode));
      const prevWeekStarting = getPreviousWeekSunday(sheet.weekStarting);
      const prevSheet = byDriverWeek.get(`${sheet.driverName}|${prevWeekStarting}`) ?? null;
      const days = parseDays(sheet.days);
      const prevWeekDays = prevSheet ? parseDays(prevSheet.days) : null;

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
        last24hBreak: sheet.last24hBreak ?? undefined,
        weekStarting: sheet.weekStarting,
        prevWeekStarting: prevSheet?.weekStarting ?? undefined,
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
