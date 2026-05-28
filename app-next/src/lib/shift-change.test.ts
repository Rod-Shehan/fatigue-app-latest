import { describe, expect, it } from "vitest";
import {
  consecutiveWorkDaysEndingAt,
  formatShiftChangeViolationMessage,
  getConsecutiveWorkRun,
  oppositeShiftLabel,
  shouldEducateAfterEndShift,
  SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS,
} from "@/lib/shift-change";
import type { ComplianceDayData } from "@/lib/compliance";

function workDay(): ComplianceDayData {
  return { work_time: Array(60).fill(true), events: [{ time: "2026-01-01T08:00:00.000Z", type: "work" }] };
}

function emptyDay(): ComplianceDayData {
  return { work_time: [], events: [] };
}

describe("shift-change helpers", () => {
  it("counts consecutive work days ending at index", () => {
    const days = [workDay(), workDay(), workDay(), emptyDay(), workDay()];
    expect(consecutiveWorkDaysEndingAt(days, 2)).toBe(3);
    expect(consecutiveWorkDaysEndingAt(days, 4)).toBe(1);
  });

  it("shouldEducateAfterEndShift when streak is 5+", () => {
    const days = Array.from({ length: 5 }, () => workDay());
    expect(shouldEducateAfterEndShift(days, 4)).toBe(true);
    expect(shouldEducateAfterEndShift(days, 3)).toBe(false);
    expect(SHIFT_CHANGE_MIN_CONSECUTIVE_WORK_DAYS).toBe(5);
  });

  it("getConsecutiveWorkRun spans gaps", () => {
    const days = [workDay(), workDay(), emptyDay(), workDay()];
    expect(getConsecutiveWorkRun(days, 1)?.length).toBe(2);
    expect(getConsecutiveWorkRun(days, 3)?.length).toBe(1);
  });

  it("oppositeShiftLabel toggles A/B", () => {
    expect(oppositeShiftLabel("A")).toBe("B");
    expect(oppositeShiftLabel("B")).toBe("A");
  });

  it("formatShiftChangeViolationMessage mentions gap and 24h", () => {
    const msg = formatShiftChangeViolationMessage({
      fromDayIndex: 0,
      toDayIndex: 1,
      fromLabel: "A",
      toLabel: "B",
      gapHours: 23.5,
    });
    expect(msg).toContain("24");
    expect(msg).toContain("23h");
  });
});
