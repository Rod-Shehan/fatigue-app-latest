import { describe, it, expect } from "vitest";
import { MINUTES_PER_DAY, normalizeCoverageFieldToMinutes, normalizeSheetDaysForApi } from "./derive-minute-coverage";

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
