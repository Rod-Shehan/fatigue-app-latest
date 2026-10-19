/** RULE IP — owner approval required before changing expected rule outcomes. See .cursor/rules/time-rules-ip.mdc */
import { describe, expect, it } from "vitest";
import {
  buildDriverComplianceWeekContext,
  pickRicherComplianceDays,
  runLocalSheetComplianceCheck,
} from "./sheet-compliance-local";
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

  it("normalizes week-starting timestamps when building lookback", () => {
    const sheets: FatigueSheet[] = [
      {
        id: "current",
        driver_name: "Jaydin Ireland",
        driver_type: "solo",
        status: "draft",
        week_starting: "2026-10-18T00:00:00.000Z",
        days: [{ work_time: [], breaks: [], non_work: [] }],
      } as FatigueSheet,
      {
        id: "prev",
        driver_name: "Jaydin Ireland",
        driver_type: "solo",
        status: "draft",
        week_starting: "2026-10-11",
        days: [
          {
            work_time: [],
            breaks: [],
            non_work: [],
            events: [{ time: "2026-10-12T18:24:00.000Z", type: "stop" }],
          },
        ],
      } as FatigueSheet,
    ];
    const ctx = buildDriverComplianceWeekContext(
      "Jaydin Ireland",
      "2026-10-18",
      sheets
    );
    expect(ctx.prevWeekStarting).toBe("2026-10-11");
    expect(ctx.prevWeekDays?.[0]?.events).toHaveLength(1);
  });

  it("picks the days tape that actually has events over empty list meta", () => {
    const emptyMeta = [] as FatigueSheet["days"];
    const local = [
      {
        work_time: [],
        breaks: [],
        non_work: [],
        events: [{ time: "2026-10-12T18:24:00.000Z", type: "stop" }],
      },
    ] as FatigueSheet["days"];
    expect(pickRicherComplianceDays(emptyMeta, local)).toEqual(local);
    expect(pickRicherComplianceDays(local, emptyMeta)).toEqual(local);
    expect(pickRicherComplianceDays(null, local)).toEqual(local);
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
