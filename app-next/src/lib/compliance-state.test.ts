import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import { complianceStateAt } from "@/lib/compliance-state";

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

describe("complianceStateAt", () => {
  it("computes headroom from retrospective timeline only", () => {
    const prevWeek = Array.from({ length: 7 }, () => dayWorkOnly(10));
    const thisWeek = Array.from({ length: 7 }, () => dayWorkOnly(0));
    thisWeek[0] = dayWorkOnly(8);
    const state = complianceStateAt({
      prevWeekDays: prevWeek,
      currentWeekDays: thisWeek,
      weekStarting: "2026-06-08",
      todayYmd: "2026-06-08",
      slotOffsetWithinToday: 12 * 60,
    });
    expect(state.rolling168h.maxRollingWorkHours).toBeGreaterThan(0);
    expect(state.rolling168h.headroomHours).toBeLessThan(168);
  });
});
