import { describe, expect, it } from "vitest";
import {
  advanceFatigueCarryState,
  buildDemoFatigueWalk,
  FATIGUE_POST_FULL_REST_MULTIPLIER,
  FATIGUE_POST_PARTIAL_BREAK_MULTIPLIER,
  inferCarryFromDiaryProxies,
} from "@/lib/fatigue-risk-carry";
import { blockInputsToRiskPercent, buildDemoRiskTimelineSeries } from "@/lib/manager-risk-timeline";

describe("fatigue carry sawtooth", () => {
  it("drops carry sharply after a 15-minute break block", () => {
    let state = { carry: 0.7 };
    state = advanceFatigueCarryState(state, { workMinutes: 0, recoveryMinutes: 15, nonWork: false });
    expect(state.carry).toBeCloseTo(0.7 * FATIGUE_POST_PARTIAL_BREAK_MULTIPLIER, 2);
  });

  it("drops carry further after full rest", () => {
    let state = { carry: 0.8 };
    state = advanceFatigueCarryState(state, { workMinutes: 0, recoveryMinutes: 30, nonWork: true });
    expect(state.carry).toBeCloseTo(0.8 * FATIGUE_POST_FULL_REST_MULTIPLIER, 2);
  });

  it("rises during consecutive work blocks", () => {
    let state = { carry: 0.1 };
    const before = state.carry;
    state = advanceFatigueCarryState(state, { workMinutes: 15, recoveryMinutes: 0, nonWork: false });
    expect(state.carry).toBeGreaterThan(before);
  });

  it("demo walk produces lower risk % immediately after break blocks", () => {
    const walk = buildDemoFatigueWalk(18, () => true);
    const risk = walk.map((w) =>
      blockInputsToRiskPercent({
        blockStartMs: 0,
        workMinutes: w.workMinutes,
        minutesSinceBreak: w.minutesSinceBreak,
        rollingWorkHours14d: 120,
        localHour: 12,
        planDeviationMinutes: 0,
        timeOnTaskCarry: w.carry,
        recoveryMinutesInBlock: w.recoveryMinutes,
        nonWorkBlock: w.nonWork,
      })
    );

    const breakIdx = walk.findIndex((w) => w.recoveryMinutes >= 15);
    expect(breakIdx).toBeGreaterThan(0);
    expect(risk[breakIdx]).toBeLessThan(risk[breakIdx - 1] - 5);
  });

  it("inferCarryFromDiaryProxies is low right after break", () => {
    expect(inferCarryFromDiaryProxies(5, 14, 0, false)).toBeLessThan(
      inferCarryFromDiaryProxies(180, 14, 0, false)
    );
  });
});

describe("demo risk timeline sawtooth shape", () => {
  it("baseline has local drops after scheduled break blocks", () => {
    const series = buildDemoRiskTimelineSeries("Test", { pastBlocks: 24, futureBlocks: 4 });
    const past = series.blocks.filter((b) => b.blockStartMs <= series.nowBlockStartMs);
    let drops = 0;
    for (let i = 1; i < past.length; i++) {
      if (past[i].baselinePct < past[i - 1].baselinePct - 8) drops++;
    }
    expect(drops).toBeGreaterThanOrEqual(2);
  });
});
