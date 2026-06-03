import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import {
  buildComplianceWeekContextFromMap,
  priorWeekSundays,
} from "@/lib/compliance-history";

describe("compliance-history", () => {
  it("priorWeekSundays walks back one week at a time", () => {
    const weeks = priorWeekSundays("2026-06-01", 3);
    expect(weeks).toEqual(["2026-05-25", "2026-05-18", "2026-05-11"]);
  });

  it("buildComplianceWeekContextFromMap keeps prev week out of historyDays", () => {
    const weekStarting = "2026-06-01";
    const sundays = priorWeekSundays(weekStarting, 3);
    const map = new Map(
      sundays.map((w, idx) => [w, { days: JSON.stringify([{ marker: idx }]) }])
    );
    const ctx = buildComplianceWeekContextFromMap(weekStarting, map, 3);
    expect(ctx.prevWeekStarting).toBe("2026-05-25");
    expect(ctx.prevWeekDays).toHaveLength(1);
    expect((ctx.prevWeekDays![0] as { marker?: number }).marker).toBe(0);
    expect(ctx.historyDays).toHaveLength(2);
    expect((ctx.historyDays[0] as { marker?: number }).marker).toBe(2);
    expect((ctx.historyDays[1] as { marker?: number }).marker).toBe(1);
  });
});
