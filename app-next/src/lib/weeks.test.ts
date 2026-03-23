import { describe, expect, it } from "vitest";
import {
  getSheetDayWeekdayShort,
  getSheetWeekRangeBounds,
  parseLocalDate,
  sheetWeeksOverlap,
} from "./weeks";

describe("getSheetWeekRangeBounds", () => {
  it("returns Sun–Sat inclusive for a Sunday start", () => {
    expect(getSheetWeekRangeBounds("2026-03-22")).toEqual({
      start: "2026-03-22",
      end: "2026-03-28",
    });
  });
});

describe("sheetWeeksOverlap", () => {
  it("is true for identical weeks", () => {
    expect(sheetWeeksOverlap("2026-03-22", "2026-03-22")).toBe(true);
  });

  it("is true when one week starts the day before (off-by-one stored Sunday)", () => {
    // Sheet Mar 21–27 vs selected work week Mar 22–28 → overlap Mar 22–27
    expect(sheetWeeksOverlap("2026-03-21", "2026-03-22")).toBe(true);
    expect(sheetWeeksOverlap("2026-03-22", "2026-03-21")).toBe(true);
  });

  it("is false for non-overlapping weeks", () => {
    expect(sheetWeeksOverlap("2026-03-01", "2026-03-22")).toBe(false);
  });
});

describe("getSheetDayWeekdayShort", () => {
  it("uses the calendar date of the column, not slot index (Sat 21 Mar 2026)", () => {
    // 21 Mar 2026 is a Saturday — label must not say Sun just because dayIndex is 0
    expect(parseLocalDate("2026-03-21").getDay()).toBe(6);
    expect(getSheetDayWeekdayShort("2026-03-21", 0).toLowerCase()).toMatch(/^sat/);
  });
});
