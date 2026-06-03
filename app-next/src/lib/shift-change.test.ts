import { describe, expect, it } from "vitest";
import {
  buildEndedWorkSegments,
  findShiftPatternTransitionsOnTimeline,
  formatShiftChangeViolationMessage,
  maxUnlabeledShiftMinutesOnTimeline,
  oppositeShiftLabel,
  patternStreakThresholdMet,
  samePatternWorkMinutesBefore,
  shiftPatternChangeRequires24hBreak,
  shouldEducateAfterEndShift,
  shouldShowShiftPatternEducation,
  SHIFT_CHANGE_MIN_GAP_HOURS,
  SHIFT_PATTERN_STREAK_MINUTES,
} from "@/lib/shift-change";
import type { ComplianceDayData } from "@/lib/compliance";

function endedShift(hours: number, label: "A" | "B" | "" = "A", startIso = "2026-01-01T00:00:00.000Z"): ComplianceDayData {
  const startMs = new Date(startIso).getTime();
  const endIso = new Date(startMs + hours * 3600 * 1000).toISOString();
  return {
    shift_label: label === "" ? "" : label,
    work_time: Array(60).fill(true),
    events: [
      { time: startIso, type: "work" },
      { time: endIso, type: "stop" },
    ],
  };
}

describe("shift-change helpers", () => {
  it("sums same-pattern minutes backward from a transition", () => {
    const days = [
      endedShift(80, "A", "2026-01-01T00:00:00.000Z"),
      endedShift(50, "A", "2026-01-05T00:00:00.000Z"),
      endedShift(10, "B", "2026-01-08T00:00:00.000Z"),
    ];
    const transitions = findShiftPatternTransitionsOnTimeline(days);
    expect(transitions).toHaveLength(1);
    const prior = samePatternWorkMinutesBefore(days, "A", transitions[0]!.workTimeMs);
    expect(prior).toBe(80 * 60 + 50 * 60);
    expect(shiftPatternChangeRequires24hBreak(days, transitions[0]!)).toBe(true);
  });

  it("does not require 24h break when prior pattern streak is under 7200 minutes", () => {
    const days = [endedShift(10, "A"), endedShift(10, "B", "2026-01-02T00:00:00.000Z")];
    const transitions = findShiftPatternTransitionsOnTimeline(days);
    expect(shiftPatternChangeRequires24hBreak(days, transitions[0]!)).toBe(false);
  });

  it("shouldEducateAfterEndShift when same-pattern streak meets 7200 minutes", () => {
    const days = [endedShift(130, "A")];
    expect(patternStreakThresholdMet(SHIFT_PATTERN_STREAK_MINUTES)).toBe(true);
    expect(shouldEducateAfterEndShift(days, 0)).toBe(true);
    expect(shouldEducateAfterEndShift([endedShift(10, "A")], 0)).toBe(false);
  });

  it("education when unlabeled shifts total 7200+ minutes on timeline", () => {
    const days = [endedShift(130, "")];
    expect(maxUnlabeledShiftMinutesOnTimeline(days)).toBeGreaterThanOrEqual(SHIFT_PATTERN_STREAK_MINUTES);
    expect(shouldShowShiftPatternEducation(days)).toBe(true);
  });

  it("oppositeShiftLabel toggles A/B", () => {
    expect(oppositeShiftLabel("A")).toBe("B");
    expect(oppositeShiftLabel("B")).toBe("A");
  });

  it("measures A→B gap on timeline across midnight, not per calendar day bucket", () => {
    const days: ComplianceDayData[] = Array.from({ length: 7 }, () => ({
      work_time: [],
      events: [],
    }));
    days[1] = {
      shift_label: "A",
      work_time: Array(60).fill(true),
      events: [
        { time: "2026-06-02T14:00:00.000Z", type: "work" },
        { time: "2026-06-03T01:00:00.000Z", type: "stop" },
      ],
    };
    days[2] = {
      shift_label: "B",
      work_time: Array(60).fill(true),
      events: [{ time: "2026-06-03T23:00:00.000Z", type: "work" }],
    };
    const transitions = findShiftPatternTransitionsOnTimeline(days);
    expect(transitions).toHaveLength(1);
    expect(transitions[0]!.gapHours).toBeCloseTo(22, 0);
    expect(transitions[0]!.gapHours).toBeLessThan(SHIFT_CHANGE_MIN_GAP_HOURS);
    expect(buildEndedWorkSegments(days)).toHaveLength(1);
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
    expect(msg).toContain("120");
  });
});
