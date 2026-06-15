import { describe, expect, it } from "vitest";
import { buildShiftWorkProjections } from "@/lib/manager-shift-lane-plans";
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

describe("buildShiftWorkProjections", () => {
  it("projects remaining planned work from now", () => {
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
              planned_on_duty_hours: 4,
              events: [{ time: new Date(nowMs - 60 * 60 * 1000).toISOString(), type: "work" }],
            }
          : {}
      ),
      status: "draft",
    };

    const projections = buildShiftWorkProjections({
      sheets: [sheet],
      driverName: "Alex",
      weekStarting: "2026-06-07",
      windowStartMs: windowStart,
      windowEndMs: windowEnd,
      nowMs,
      events: [{ time: new Date(nowMs - 60 * 60 * 1000).toISOString(), type: "work" }],
      todayYmd: "2026-06-11",
    });

    expect(projections.length).toBe(1);
    expect(projections[0].plannedHours).toBe(4);
    expect(projections[0].startMs).toBe(nowMs);
    expect(projections[0].endMs - projections[0].startMs).toBe(3 * 60 * 60 * 1000);
  });
});
