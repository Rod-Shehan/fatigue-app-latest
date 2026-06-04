import { describe, expect, it } from "vitest";
import {
  applyQueuedLiveBlocks,
  blockInputsToRiskPercent,
  buildDemoRiskTimelineSeries,
  findCrossoverIntervals,
  logisticRiskPercentile,
  standardize,
} from "@/lib/manager-risk-timeline";

describe("manager risk timeline scoring", () => {
  it("logistic maps z-score to 0–100", () => {
    expect(logisticRiskPercentile(-3)).toBeLessThan(10);
    expect(logisticRiskPercentile(3)).toBeGreaterThan(90);
    expect(logisticRiskPercentile(0)).toBeGreaterThan(40);
    expect(logisticRiskPercentile(0)).toBeLessThan(60);
  });

  it("blockInputsToRiskPercent stays bounded", () => {
    const pct = blockInputsToRiskPercent({
      blockStartMs: Date.now(),
      workMinutes: 15,
      minutesSinceBreak: 400,
      rollingWorkHours14d: 160,
      localHour: 3,
      planDeviationMinutes: 10,
    });
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("standardize handles zero variance safely", () => {
    expect(standardize(5, 5, 0)).toBe(0);
  });
});

describe("manager risk timeline queue", () => {
  it("applyQueuedLiveBlocks merges out-of-order without duplicates", () => {
    const series = buildDemoRiskTimelineSeries("Test Driver");
    const target = series.blocks.find((b) => b.livePct == null);
    expect(target).toBeDefined();
    const merged = applyQueuedLiveBlocks(series.blocks, [
      { blockStartMs: target!.blockStartMs, livePct: 55 },
      { blockStartMs: target!.blockStartMs, livePct: 58 },
    ]);
    const row = merged.find((b) => b.blockStartMs === target!.blockStartMs);
    expect(row?.livePct).toBe(58);
  });

  it("findCrossoverIntervals detects live above baseline", () => {
    const blocks = [
      { blockStartMs: 1, label: "a", baselinePct: 30, livePct: 25 },
      { blockStartMs: 2, label: "b", baselinePct: 30, livePct: 45 },
      { blockStartMs: 3, label: "c", baselinePct: 30, livePct: 50 },
      { blockStartMs: 4, label: "d", baselinePct: 30, livePct: 28 },
    ];
    const intervals = findCrossoverIntervals(blocks);
    expect(intervals.length).toBe(1);
    expect(intervals[0].startMs).toBe(2);
  });
});
