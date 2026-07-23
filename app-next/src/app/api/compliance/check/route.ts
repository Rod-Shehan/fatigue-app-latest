import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import type { ComplianceDayData } from "@/lib/compliance";
import { getComplianceEngine, parseJurisdictionCode } from "@/lib/jurisdiction";

export type ComplianceCheckPayload = {
  days: ComplianceDayData[];
  driverType?: string;
  prevWeekDays?: ComplianceDayData[] | null;
  historyDays?: ComplianceDayData[] | null;
  last24hBreak?: string;
  last24hBreakEndMs?: number | null;
  declared24hRests?: {
    last_24h_rest_1?: string | null;
    last_24h_rest_2?: string | null;
    last_24h_rest_3?: string | null;
    last_24h_rest_4?: string | null;
  } | null;
  weekStarting?: string;
  prevWeekStarting?: string;
  currentDayIndex?: number;
  /** Minutes since local midnight for “now” on the active day (0–1440). */
  slotOffsetWithinToday?: number;
  /** Sheet-level rule set (snake_case or camelCase). */
  jurisdiction_code?: string;
  jurisdictionCode?: string;
};

export async function POST(req: Request) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as ComplianceCheckPayload;
    const {
      days,
      driverType = "solo",
      prevWeekDays,
      historyDays,
      last24hBreak,
      last24hBreakEndMs,
      declared24hRests,
      weekStarting,
      prevWeekStarting,
      currentDayIndex,
      slotOffsetWithinToday,
      jurisdiction_code,
      jurisdictionCode,
    } = body;
    if (!Array.isArray(days)) {
      return NextResponse.json({ error: "days must be an array" }, { status: 400 });
    }
    const engine = getComplianceEngine(
      parseJurisdictionCode(jurisdictionCode ?? jurisdiction_code)
    );
    const results = engine.run(days, {
      driverType,
      prevWeekDays: prevWeekDays ?? null,
      historyDays: historyDays ?? null,
      last24hBreak,
      last24hBreakEndMs: last24hBreakEndMs ?? null,
      declared24hRests: declared24hRests ?? null,
      weekStarting,
      prevWeekStarting,
      currentDayIndex,
      slotOffsetWithinToday,
    });
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Compliance check failed" },
      { status: 500 }
    );
  }
}
