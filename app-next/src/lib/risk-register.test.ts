import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { buildRiskRegisterFromWeek } from "@/lib/risk-register";

function dayWorkOnly(hours: number) {
  const mins = Math.min(MINUTES_PER_DAY, Math.round(hours * 60));
  const work_time = Array(MINUTES_PER_DAY).fill(false);
  for (let i = 0; i < mins; i++) work_time[i] = true;
  return {
    work_time,
    breaks: Array(MINUTES_PER_DAY).fill(false),
    non_work: work_time.map((w) => !w),
  };
}

describe("buildRiskRegisterFromWeek", () => {
  it("returns no entries when no future run plans", () => {
    const week = Array.from({ length: 7 }, () => dayWorkOnly(0));
    const reg = buildRiskRegisterFromWeek(week, {
      weekStarting: "2026-06-01",
      todayYmd: "2026-06-05",
    });
    expect(reg.entries).toHaveLength(0);
    expect(reg.driverHint).toBeNull();
  });

  it("flags elevated risk when future plan stacks on heavy history", () => {
    const historyDays = Array.from({ length: 14 }, () => dayWorkOnly(12));
    const week = Array.from({ length: 7 }, () => dayWorkOnly(0));
    week[5] = {
      ...dayWorkOnly(0),
      route_label: "Long return",
      planned_on_duty_hours: 12,
      planned_distance_km: 500,
    };
    const reg = buildRiskRegisterFromWeek(week, {
      weekStarting: "2026-06-01",
      todayYmd: "2026-06-03",
      historyDays,
    });
    expect(reg.entries.length).toBeGreaterThan(0);
    expect(["monitor", "elevated", "critical"]).toContain(reg.worstLevel);
    expect(reg.entries.some((e) => e.outcomes.includes("168h_breach_if_plan_holds") || e.outcomes.includes("168h_warning_if_plan_holds"))).toBe(
      true
    );
  });
});
