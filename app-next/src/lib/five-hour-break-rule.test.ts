/** RULE IP — owner approval required before changing expected rule outcomes. See .cursor/rules/time-rules-ip.mdc */
import { describe, it, expect } from "vitest";
import {
  applyQualifyingBreakSegment,
  emptySlots,
  qualifyingRestComplete,
  restSlotsFromBreakMinutesInOrder,
  qualifyingRestMetForWorkAfterBreak,
  findWorkWindowStartMs,
  getMinutesBeforeDueFromSlots,
  getBreakSplitBarState,
  getBreakDueByTime,
  computeWorkPeriodAtEnd,
} from "./five-hour-break-rule";

describe("five-hour-break-rule", () => {
  it("segments under 10 min do not fill slots", () => {
    const s = emptySlots();
    applyQualifyingBreakSegment(9, s);
    expect(qualifyingRestComplete(s)).toBe(false);
  });

  it("one 20 min segment fills both slots", () => {
    const s = emptySlots();
    applyQualifyingBreakSegment(20, s);
    expect(qualifyingRestComplete(s)).toBe(true);
  });

  it("two 10 min segments fill both slots", () => {
    expect(qualifyingRestComplete(restSlotsFromBreakMinutesInOrder([10, 10]))).toBe(true);
  });

  it("15 min then 5 min does not satisfy (5 min is not qualifying)", () => {
    expect(qualifyingRestComplete(restSlotsFromBreakMinutesInOrder([15, 5]))).toBe(false);
  });

  it("getMinutesBeforeDueFromSlots: none / one / both", () => {
    expect(getMinutesBeforeDueFromSlots(emptySlots())).toBe(20);
    expect(getMinutesBeforeDueFromSlots({ slot1: true, slot2: false })).toBe(10);
    expect(getMinutesBeforeDueFromSlots({ slot1: true, slot2: true })).toBe(0);
  });

  it("getBreakSplitBarState: no prior, 15 min elapsed — left full, right half", () => {
    const st = getBreakSplitBarState(emptySlots(), 15);
    expect(st.leftPct).toBe(100);
    expect(st.rightPct).toBe(50);
    expect(st.complete).toBe(false);
  });

  it("qualifyingRestMetForWorkAfterBreak: 10+10 in separate breaks in same 5h window", () => {
    const t0 = new Date("2026-06-01T00:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const work300 = 300 * 60 * 1000;
    const events = [
      { time: iso(t0), type: "work" },
      { time: iso(t0 + work300), type: "break" },
      { time: iso(t0 + work300 + 10 * 60 * 1000), type: "work" },
      { time: iso(t0 + work300 + 10 * 60 * 1000 + 60 * 60 * 1000), type: "break" },
    ];
    const lastBreakDurMin = 10;
    expect(qualifyingRestMetForWorkAfterBreak(events, [lastBreakDurMin])).toBe(true);
  });

  it("findWorkWindowStartMs ends at work now", () => {
    const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const work120 = 120 * 60 * 1000;
    const events = [{ time: iso(t0), type: "work" }];
    const nowMs = t0 + work120;
    const ws = findWorkWindowStartMs(events, nowMs);
    expect(ws).toBe(t0);
  });

  it("computeWorkPeriodAtEnd resets after qualifying 20 min breaks", () => {
    const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const h = (n: number) => n * 60 * 60 * 1000;
    const m = (n: number) => n * 60 * 1000;
    let t = t0;
    const events = [
      { time: iso((t += 0)), type: "work" },
      { time: iso((t += h(3))), type: "break" },
      { time: iso((t += m(20))), type: "work" },
      { time: iso((t += h(2))), type: "break" },
      { time: iso((t += m(20))), type: "work" },
    ];
    const nowMs = t + h(1) + m(49);
    const period = computeWorkPeriodAtEnd(events, nowMs);
    expect(period?.workMins).toBe(109);
  });

  it("getBreakDueByTime is not overdue after qualifying breaks reset the work period", () => {
    const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const h = (n: number) => n * 60 * 60 * 1000;
    const m = (n: number) => n * 60 * 1000;
    let t = t0;
    const events = [
      { time: iso((t += 0)), type: "work" },
      { time: iso((t += h(3))), type: "break" },
      { time: iso((t += m(20))), type: "work" },
      { time: iso((t += h(2))), type: "break" },
      { time: iso((t += m(20))), type: "work" },
    ];
    const nowMs = t + h(1) + m(49);
    const dueBy = getBreakDueByTime(events, nowMs);
    expect(dueBy).not.toBeNull();
    expect(dueBy!).toBeGreaterThan(nowMs + 60 * 60 * 1000);
  });

  it("getBreakDueByTime is in the past when 5h work has no qualifying rest", () => {
    const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const work300 = 300 * 60 * 1000;
    const events = [{ time: iso(t0), type: "work" }];
    const nowMs = t0 + work300 + 10 * 60 * 1000;
    const dueBy = getBreakDueByTime(events, nowMs);
    expect(dueBy).not.toBeNull();
    expect(dueBy!).toBeLessThan(nowMs);
  });

  it("counts other_work as break-from-driving rest, not 5h work minutes", () => {
    const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const events = [
      { time: iso(t0), type: "work" },
      { time: iso(t0 + 60 * 60 * 1000), type: "other_work" },
    ];
    const nowMs = t0 + 2 * 60 * 60 * 1000;
    const period = computeWorkPeriodAtEnd(events, nowMs);
    expect(period?.workMins).toBe(60);
  });

  it("20 min other_work after 5h work satisfies qualifying rest", () => {
    const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
    const iso = (ms: number) => new Date(ms).toISOString();
    const work300 = 300 * 60 * 1000;
    const events = [
      { time: iso(t0), type: "work" },
      { time: iso(t0 + work300), type: "other_work" },
    ];
    expect(qualifyingRestMetForWorkAfterBreak(events, [20])).toBe(true);
  });
});
