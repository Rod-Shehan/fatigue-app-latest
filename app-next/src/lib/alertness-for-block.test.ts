import { describe, expect, it } from "vitest";
import {
  findAlertnessLevelForSheetDay,
  stampAlertnessForCalendarDay,
  ymdFromBlockStartMs,
} from "@/lib/alertness-for-block";
import { getPerthMidnightUtcMs, getSheetDayDateString } from "@/lib/weeks";
import type { DayData } from "@/lib/api";

describe("alertness-for-block", () => {
  it("finds alertness for a block on the matching sheet day", () => {
    const weekStarting = "2026-06-07";
    const dayYmd = getSheetDayDateString(weekStarting, 4);
    const blockStartMs = getPerthMidnightUtcMs(dayYmd) + 10 * 60 * 60 * 1000;
    const days: DayData[] = Array.from({ length: 7 }, () => ({}));
    days[4] = { alertness_level: 4 };

    expect(findAlertnessLevelForSheetDay(weekStarting, days, blockStartMs)).toBe(4);
    expect(ymdFromBlockStartMs(blockStartMs)).toBe(dayYmd);
  });

  it("stamps all blocks on a calendar day", () => {
    const map = new Map<number, 1 | 2 | 3 | 4 | 5>();
    stampAlertnessForCalendarDay(map, "2026-06-07", 0, 3);
    expect(map.size).toBeGreaterThan(90);
    expect([...map.values()].every((v) => v === 3)).toBe(true);
  });
});
