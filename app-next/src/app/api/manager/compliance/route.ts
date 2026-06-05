import { NextRequest, NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getComplianceEngine, parseJurisdictionCode } from "@/lib/jurisdiction";
import type { ManagerComplianceItem } from "@/lib/api";
import { getSlotOffsetWithinTodayLocal } from "@/lib/compliance";
import { buildRiskRegister } from "@/lib/risk-register";
import { getRegulatoryTodayYmd } from "@/lib/weeks";
import {
  buildComplianceWeekContextFromMap,
  parseSheetDaysJson,
} from "@/lib/compliance-history";
import { getRecordRetentionPolicy } from "@/lib/record-retention";
import { getPreviousWeekSunday, getThisWeekSunday } from "@/lib/weeks";
import { isFrmsEngineEnabled, resolveFrmsProspectiveRegister } from "@/lib/frms/orchestrator";

const WEEK_YMD = /^\d{4}-\d{2}-\d{2}$/;

function resolveFocusWeek(weekStarting: string | null): string {
  if (weekStarting && WEEK_YMD.test(weekStarting)) return weekStarting;
  return getThisWeekSunday();
}

/**
 * GET /api/manager/compliance?weekStarting=YYYY-MM-DD
 * Compliance for the manager-selected work week (and the week before for assurance).
 * No global row cap — scoped to those weeks and full per-driver history for rule lookback.
 */
export async function GET(request: NextRequest) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const focusWeek = resolveFocusWeek(searchParams.get("weekStarting"));
    const priorWeek = getPreviousWeekSunday(focusWeek);
    const weeksEvaluated = [priorWeek, focusWeek];

    const snapshotSheets = await prisma.fatigueSheet.findMany({
      where: { weekStarting: { in: weeksEvaluated } },
      orderBy: [{ weekStarting: "desc" }, { driverName: "asc" }],
    });

    const drivers = [...new Set(snapshotSheets.map((s) => s.driverName))];
    const driverSheets = drivers.length
      ? await prisma.fatigueSheet.findMany({
          where: { driverName: { in: drivers } },
          select: {
            driverName: true,
            weekStarting: true,
            days: true,
            id: true,
            driverType: true,
            last24hBreak: true,
            jurisdictionCode: true,
          },
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

    const items: ManagerComplianceItem[] = [];
    for (const sheet of snapshotSheets) {
      const slotOffsetWithinToday = getSlotOffsetWithinTodayLocal(now, sheet.jurisdictionCode);
      const todayStr = getRegulatoryTodayYmd(sheet.jurisdictionCode);
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

      let risk_register = buildRiskRegister({
        days,
        stateInput: {
          currentWeekDays: days,
          weekStarting: sheet.weekStarting,
          todayYmd: todayStr,
          historyDays,
          prevWeekDays,
          slotOffsetWithinToday,
          currentDayIndex,
        },
      });

      if (isFrmsEngineEnabled()) {
        const frms = await resolveFrmsProspectiveRegister(prisma, {
          driverName: sheet.driverName,
          weekStarting: sheet.weekStarting,
          weekMap,
          jurisdictionCode: sheet.jurisdictionCode,
          driverType: sheet.driverType ?? "solo",
        });
        if (frms.register) {
          risk_register = frms.register;
        }
      }

      items.push({
        sheetId: sheet.id,
        driver_name: sheet.driverName,
        week_starting: sheet.weekStarting,
        results,
        eventsWithLocation,
        totalEvents,
        risk_register,
      });
    }

    return NextResponse.json({
      items,
      policy: getRecordRetentionPolicy(),
      focus_week: focusWeek,
      weeks_evaluated: weeksEvaluated,
    });
  } catch (e) {
    console.error("Manager compliance error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 }
    );
  }
}
