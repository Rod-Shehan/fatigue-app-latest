import { describe, expect, it } from "vitest";
import {
  findSheetDayIndexForYmd,
  resolveEndShiftFinishDayOptions,
} from "./end-shift-finish-day";

describe("findSheetDayIndexForYmd", () => {
  it("maps mid-week ymd to day index", () => {
    // Sunday 19 Jul 2026
    expect(findSheetDayIndexForYmd("2026-07-19", "2026-07-20")).toBe(1);
    expect(findSheetDayIndexForYmd("2026-07-19", "2026-07-21")).toBe(2);
  });

  it("returns null outside the sheet week", () => {
    expect(findSheetDayIndexForYmd("2026-07-19", "2026-07-18")).toBeNull();
  });
});

describe("resolveEndShiftFinishDayOptions", () => {
  const weekStarting = "2026-07-19"; // Sun

  it("defaults to last-open day when that day is before today (forgotten overnight)", () => {
    const out = resolveEndShiftFinishDayOptions({
      lastOpenEventIso: "2026-07-20T08:00:00",
      todayYmd: "2026-07-21",
      weekStarting,
      tappedDayIndex: 2,
    });
    expect(out).toMatchObject({
      minYmd: "2026-07-20",
      maxYmd: "2026-07-21",
      defaultYmd: "2026-07-20",
      defaultDayIndex: 1,
      showDatePicker: true,
    });
  });

  it("defaults to today when last open is today", () => {
    const out = resolveEndShiftFinishDayOptions({
      lastOpenEventIso: "2026-07-21T06:00:00",
      todayYmd: "2026-07-21",
      weekStarting,
      tappedDayIndex: 2,
    });
    expect(out).toMatchObject({
      minYmd: "2026-07-21",
      maxYmd: "2026-07-21",
      defaultYmd: "2026-07-21",
      defaultDayIndex: 2,
      showDatePicker: false,
    });
  });
});
