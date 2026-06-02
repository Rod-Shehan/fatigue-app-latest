import { describe, it, expect } from "vitest";
import { getShiftRestStatusFromWorkGrid } from "./shift-rest-status";

function ts(iso: string): number {
  return new Date(iso).getTime();
}

describe("getShiftRestStatusFromWorkGrid", () => {
  it("counts non-work minutes back to last work minute (1440 grid)", () => {
    const day0 = { work_time: Array(1440).fill(false) as boolean[] };
    day0.work_time[60] = true; // 01:00 has work
    const now = ts("2026-06-02T02:00:00");
    const out = getShiftRestStatusFromWorkGrid([day0], 0, now);
    // From 02:00 back to 01:01 = 59 minutes (inclusive window is minute-based; we just want "near 60")
    expect(out.consecutiveNonWorkMinutes).toBeGreaterThan(50);
  });

  it("supports legacy 48-slot grids", () => {
    const slots = Array(48).fill(false);
    slots[10] = true; // 05:00–05:30 has work
    const now = ts("2026-06-02T06:00:00");
    const out = getShiftRestStatusFromWorkGrid([{ work_time: slots }], 0, now);
    expect(out.consecutiveNonWorkMinutes).toBeGreaterThan(20);
  });

  it("continues across days when no work today", () => {
    const day0 = { work_time: Array(1440).fill(false) as boolean[] };
    // last work at 23:00 on day0
    day0.work_time[23 * 60] = true;
    const day1 = { work_time: Array(1440).fill(false) as boolean[] };
    const now = ts("2026-06-03T03:00:00");
    const out = getShiftRestStatusFromWorkGrid([day0, day1], 1, now);
    expect(out.consecutiveNonWorkMinutes).toBeGreaterThanOrEqual(4 * 60);
  });
});

