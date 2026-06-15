import { describe, expect, it } from "vitest";
import {
  buildCycledWorkSegments,
  buildShiftDutySegments,
  getBreakDueRange,
} from "@/lib/manager-shift-lane-plans";
import { resolvePlannedOnDutyHours } from "@/lib/route-plan";
import { findNowBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import type { FatigueSheet } from "@/lib/api";

describe("resolvePlannedOnDutyHours", () => {
  it("prefers declared hours", () => {
    expect(resolvePlannedOnDutyHours({ planned_on_duty_hours: 9 })).toBe(9);
  });

  it("derives hours from planned km", () => {
    expect(resolvePlannedOnDutyHours({ planned_distance_km: 500 })).toBe(10);
  });

  it("derives hours from manual start/end kms", () => {
    expect(resolvePlannedOnDutyHours({ start_kms: 1000, end_kms: 1500 })).toBe(10);
  });
});

describe("buildCycledWorkSegments", () => {
  it("inserts a break after five hours of projected work", () => {
    const startMs = Date.parse("2026-06-11T12:00:00+08:00");
    const horizon = startMs + 6 * 60 * 60 * 1000;
    const segments = buildCycledWorkSegments(
      startMs,
      horizon,
      6 * 60 * 60 * 1000,
      [],
      startMs,
      "Test run"
    );
    expect(segments.some((s) => s.kind === "work")).toBe(true);
    expect(segments.some((s) => s.kind === "break")).toBe(true);
  });
});

describe("getBreakDueRange", () => {
  it("returns overdue window when working past break due", () => {
    const nowMs = Date.parse("2026-06-11T12:00:00+08:00");
    const workStart = new Date(nowMs - 5.5 * 60 * 60 * 1000).toISOString();
    const range = getBreakDueRange([{ time: workStart, type: "work" }], nowMs);
    expect(range).not.toBeNull();
    expect(range!.endMs).toBe(nowMs);
    expect(range!.startMs).toBeLessThan(nowMs);
  });
});

describe("buildShiftDutySegments", () => {
  it("projects cycled duty from remaining planned work", () => {
    const nowMs = Date.parse("2026-06-11T10:00:00+08:00");
    const blockMs = RISK_BLOCK_MINUTES * 60 * 1000;
    const windowStart = findNowBlockStartMs(nowMs) - 32 * blockMs;
    const windowEnd = findNowBlockStartMs(nowMs) + 12 * blockMs + blockMs;

    const sheet: FatigueSheet = {
      id: "s1",
      driver_name: "Alex",
      week_starting: "2026-06-07",
      days: Array.from({ length: 7 }, (_, i) =>
        i === 4
          ? {
              route_label: "Kalgoorlie",
              planned_on_duty_hours: 6,
              events: [{ time: new Date(nowMs - 60 * 60 * 1000).toISOString(), type: "work" }],
            }
          : {}
      ),
      status: "draft",
    };

    const segments = buildShiftDutySegments({
      sheets: [sheet],
      driverName: "Alex",
      weekStarting: "2026-06-07",
      windowStartMs: windowStart,
      windowEndMs: windowEnd,
      nowMs,
      events: [{ time: new Date(nowMs - 60 * 60 * 1000).toISOString(), type: "work" }],
      todayYmd: "2026-06-11",
    });

    expect(segments.length).toBeGreaterThan(0);
    expect(segments.some((s) => s.kind === "work")).toBe(true);
    expect(segments[0].startMs).toBeGreaterThanOrEqual(findNowBlockStartMs(nowMs) + blockMs);
  });
});
