import { describe, it, expect } from "vitest";
import { getShiftRestStatusFromWorkGrid } from "./shift-rest-status";

function ts(iso: string): number {
  return new Date(iso).getTime();
}

describe("getShiftRestStatusFromWorkGrid (legacy grid fallback)", () => {
  it("counts non-work minutes back to last work minute (1440 grid)", () => {
    const day0 = { work_time: Array(1440).fill(false) as boolean[] };
    day0.work_time[60] = true;
    const now = ts("2026-06-02T02:00:00");
    const out = getShiftRestStatusFromWorkGrid([day0], 0, now);
    expect(out.consecutiveNonWorkMinutes).toBeGreaterThan(50);
  });

  it("continues across consecutive record slices when no work on later slice", () => {
    const day0 = { work_time: Array(1440).fill(false) as boolean[] };
    day0.work_time[23 * 60] = true;
    const day1 = { work_time: Array(1440).fill(false) as boolean[] };
    const now = ts("2026-06-03T03:00:00");
    const out = getShiftRestStatusFromWorkGrid([day0, day1], 1, now);
    expect(out.consecutiveNonWorkMinutes).toBeGreaterThanOrEqual(4 * 60);
  });
});
