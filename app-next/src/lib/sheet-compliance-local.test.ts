/** RULE IP — owner approval required before changing expected rule outcomes. See .cursor/rules/time-rules-ip.mdc */
import { describe, expect, it } from "vitest";
import { buildDriverComplianceWeekContext, runLocalSheetComplianceCheck } from "./sheet-compliance-local";
import type { FatigueSheet } from "@/lib/api";

describe("sheet-compliance-local", () => {
  it("builds week context from cached sheets list", () => {
    const sheets: FatigueSheet[] = [
      {
        id: "a",
        driver_name: "Alex",
        week_starting: "2026-06-07",
        days: [{ work_time: [], breaks: [], non_work: [] }],
      } as FatigueSheet,
      {
        id: "b",
        driver_name: "Alex",
        week_starting: "2026-05-31",
        days: [{ work_time: [], breaks: [], non_work: [] }],
      } as FatigueSheet,
    ];
    const ctx = buildDriverComplianceWeekContext("Alex", "2026-06-07", sheets);
    expect(ctx.prevWeekStarting).toBe("2026-05-31");
    expect(ctx.prevWeekDays).toHaveLength(1);
  });

  it("runs compliance without network", () => {
    const days = Array.from({ length: 7 }, () => ({
      work_time: Array(1440).fill(false),
      breaks: Array(1440).fill(false),
      non_work: Array(1440).fill(false),
    }));
    const results = runLocalSheetComplianceCheck({
      days,
      driverType: "solo",
      jurisdiction_code: "WA_OSH_3132",
      weekStarting: "2026-06-07",
      currentDayIndex: 0,
      slotOffsetWithinToday: 120,
    });
    expect(Array.isArray(results)).toBe(true);
  });
});
