import { NextResponse } from "next/server";
import { getSessionForSheetAccess } from "@/lib/auth";
import type { ComplianceDayData } from "@/lib/compliance";
import { getComplianceEngine, parseJurisdictionCode } from "@/lib/jurisdiction";

export type ComplianceCheckPayload = {
  days: ComplianceDayData[];
  driverType?: string;
  prevWeekDays?: ComplianceDayData[] | null;
  last24hBreak?: string;
  weekStarting?: string;
  prevWeekStarting?: string;
  currentDayIndex?: number;
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
      last24hBreak,
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
      last24hBreak,
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
