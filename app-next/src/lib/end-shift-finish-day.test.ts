import { describe, expect, it } from "vitest";
import type { DayData } from "@/lib/api";
import {
  findOpenShiftEpisodeStart,
  findOpenWorkOrBreakOnTimeline,
} from "./shift-timeline-correction";
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

describe("findOpenShiftEpisodeStart", () => {
  it("returns Monday work when Tuesday only has carry (no Tuesday events)", () => {
    const days: DayData[] = [
      {}, // Sun
      { events: [{ time: "2026-07-20T08:00:00", type: "work" }] }, // Mon
      {}, // Tue — follow-on paint only
    ];
    const asOf = Date.parse("2026-07-21T02:00:00");
    const open = findOpenWorkOrBreakOnTimeline(days, asOf);
    const start = findOpenShiftEpisodeStart(days, asOf);
    expect(open?.dayIndex).toBe(1);
    expect(start?.dayIndex).toBe(1);
    expect(start?.type).toBe("work");
  });

  it("still returns Monday work when a Tuesday break was logged later", () => {
    const days: DayData[] = [
      {},
      { events: [{ time: "2026-07-20T08:00:00", type: "work" }] },
      { events: [{ time: "2026-07-21T01:00:00", type: "break" }] },
    ];
    const asOf = Date.parse("2026-07-21T02:00:00");
    expect(findOpenWorkOrBreakOnTimeline(days, asOf)?.dayIndex).toBe(2);
    expect(findOpenShiftEpisodeStart(days, asOf)?.dayIndex).toBe(1);
  });
});

describe("resolveEndShiftFinishDayOptions", () => {
  const weekStarting = "2026-07-19"; // Sun

  it("min is episode-start day when Tuesday is only follow-on paint", () => {
    const out = resolveEndShiftFinishDayOptions({
      episodeStartDayIndex: 1, // Mon work
      lastOpenDayIndex: 1,
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

  it("keeps Monday selectable when last open is a Tuesday break", () => {
    const out = resolveEndShiftFinishDayOptions({
      episodeStartDayIndex: 1,
      lastOpenDayIndex: 2,
      todayYmd: "2026-07-21",
      weekStarting,
      tappedDayIndex: 2,
    });
    expect(out).toMatchObject({
      minYmd: "2026-07-20",
      maxYmd: "2026-07-21",
      defaultYmd: "2026-07-21",
      defaultDayIndex: 2,
      showDatePicker: true,
    });
  });

  it("hides date picker when the whole open shift is today", () => {
    const out = resolveEndShiftFinishDayOptions({
      episodeStartDayIndex: 2,
      lastOpenDayIndex: 2,
      todayYmd: "2026-07-21",
      weekStarting,
      tappedDayIndex: 2,
    });
    expect(out).toMatchObject({
      minYmd: "2026-07-21",
      maxYmd: "2026-07-21",
      defaultYmd: "2026-07-21",
      showDatePicker: false,
    });
  });
});
