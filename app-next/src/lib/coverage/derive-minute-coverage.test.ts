import { describe, it, expect } from "vitest";
import {
  deriveMinuteGridFromEvents,
  MINUTES_PER_DAY,
  normalizeCoverageFieldToMinutes,
  normalizeSheetDaysForApi,
} from "./derive-minute-coverage";

describe("normalizeCoverageFieldToMinutes", () => {
  it("pads short minute arrays to 1440 without treating them as half-hour slots", () => {
    const short = Array(100).fill(true);
    const out = normalizeCoverageFieldToMinutes(short);
    expect(out.length).toBe(MINUTES_PER_DAY);
    expect(out.filter(Boolean).length).toBe(100);
  });

  it("truncates overlong arrays to one day (guards accidental concatenation)", () => {
    const long = Array(3000).fill(true);
    const out = normalizeCoverageFieldToMinutes(long);
    expect(out.length).toBe(MINUTES_PER_DAY);
    expect(out.every(Boolean)).toBe(true);
  });
});

describe("deriveMinuteGridFromEvents", () => {
  it("marks explicit non_work events on the non_work grid", () => {
    const dateStr = "2099-06-01";
    const grid = deriveMinuteGridFromEvents(
      [
        { time: `${dateStr}T06:00:00`, type: "work" },
        { time: `${dateStr}T10:00:00`, type: "non_work" },
        { time: `${dateStr}T14:00:00`, type: "work" },
        { time: `${dateStr}T18:00:00`, type: "stop" },
      ],
      dateStr,
      { isToday: false, todayStr: "2099-12-31" }
    );
    const nonWorkMinutes = grid.non_work.filter(Boolean).length;
    expect(nonWorkMinutes).toBeGreaterThanOrEqual(4 * 60);
    expect(grid.work_time.filter(Boolean).length).toBeGreaterThan(0);
  });

  it("paints End shift as non-work immediately (does not invent ≤30m break)", () => {
    const dateStr = "2099-06-01";
    const grid = deriveMinuteGridFromEvents(
      [
        { time: `${dateStr}T08:00:00`, type: "work" },
        { time: `${dateStr}T12:00:00`, type: "stop" },
        { time: `${dateStr}T12:20:00`, type: "work" },
      ],
      dateStr,
      { isToday: false, todayStr: "2099-12-31" }
    );
    // 12:00–12:20 = 20 minutes after End shift — must stay non-work, not break
    const start = 12 * 60;
    const end = 12 * 60 + 20;
    expect(grid.non_work.slice(start, end).every(Boolean)).toBe(true);
    expect(grid.breaks.slice(start, end).some(Boolean)).toBe(false);
    expect(grid.work_time.slice(start, end).some(Boolean)).toBe(false);
  });

  it("keeps short actioned break as break (≤30 min)", () => {
    const dateStr = "2099-06-01";
    const grid = deriveMinuteGridFromEvents(
      [
        { time: `${dateStr}T08:00:00`, type: "work" },
        { time: `${dateStr}T12:00:00`, type: "break" },
        { time: `${dateStr}T12:20:00`, type: "work" },
      ],
      dateStr,
      { isToday: false, todayStr: "2099-12-31" }
    );
    const start = 12 * 60;
    const end = 12 * 60 + 20;
    expect(grid.breaks.slice(start, end).every(Boolean)).toBe(true);
    expect(grid.non_work.slice(start, end).some(Boolean)).toBe(false);
  });
});

describe("normalizeSheetDaysForApi", () => {
  it("expands legacy 48-slot grids to 1440 minutes per day", () => {
    const days = [
      {
        work_time: Array(48)
          .fill(false)
          .map((_, i) => i < 10),
        breaks: Array(48).fill(false),
        non_work: Array(48).fill(false),
      },
    ];
    const out = normalizeSheetDaysForApi(days) as { work_time: boolean[]; breaks: boolean[]; non_work: boolean[] }[];
    expect(out[0].work_time.length).toBe(MINUTES_PER_DAY);
    expect(out[0].breaks.length).toBe(MINUTES_PER_DAY);
    expect(out[0].non_work.length).toBe(MINUTES_PER_DAY);
    const trueMinutes = out[0].work_time.filter(Boolean).length;
    expect(trueMinutes).toBe(10 * 30);
  });

  it("returns empty array for non-array input", () => {
    expect(normalizeSheetDaysForApi(null)).toEqual([]);
    expect(normalizeSheetDaysForApi(undefined)).toEqual([]);
    expect(normalizeSheetDaysForApi({})).toEqual([]);
  });

  it("preserves events on a day object", () => {
    const days = [
      {
        work_time: Array(48).fill(false),
        breaks: Array(48).fill(false),
        non_work: Array(48).fill(false),
        events: [{ time: "2026-01-01T00:00:00.000Z", type: "work" }],
      },
    ];
    const out = normalizeSheetDaysForApi(days) as { events?: unknown[] }[];
    expect(out[0].events).toHaveLength(1);
  });
});
