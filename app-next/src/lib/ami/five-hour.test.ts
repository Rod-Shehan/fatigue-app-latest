import { describe, expect, it } from "vitest";
import {
  buildEvalTape,
  evaluateFiveHourBreakRule,
  type AmiEvent,
} from "./index";

describe("AMI five-hour (Phase 4 parity)", () => {
  it("scores the last work block even when asOf is after End shift", () => {
    const events: AmiEvent[] = [
      { time: "2026-06-12T08:00:00", type: "work" },
      { time: "2026-06-12T12:00:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-06-14T12:00:00");
    const tape = buildEvalTape(events, asOf, 72 * 60);
    const result = evaluateFiveHourBreakRule(tape);
    expect(result.workMinutesInWindow).toBe(240);
    expect(result.restComplete).toBe(true); // under 300 work minutes
  });

  it("flags incomplete rest when last work block exceeds 5h without breaks", () => {
    const events: AmiEvent[] = [
      { time: "2026-06-12T06:00:00", type: "work" },
      { time: "2026-06-12T12:00:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-06-12T14:00:00");
    const tape = buildEvalTape(events, asOf, 72 * 60);
    const result = evaluateFiveHourBreakRule(tape);
    expect(result.workMinutesInWindow).toBeGreaterThanOrEqual(300);
    expect(result.restComplete).toBe(false);
  });

  it("≥31 min meal break reclassed to non_work still covers the 5h rest rule", () => {
    // ~4.5h work, 35 min break (≥31 → non_work), ~3.5h work — >5h work with one long rest
    const events: AmiEvent[] = [
      { time: "2026-07-22T10:00:00", type: "work" },
      { time: "2026-07-22T14:30:00", type: "break" },
      { time: "2026-07-22T15:05:00", type: "work" },
      { time: "2026-07-22T18:35:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-07-22T19:00:00");
    const tape = buildEvalTape(events, asOf, 72 * 60);
    const result = evaluateFiveHourBreakRule(tape);
    expect(result.workMinutesInWindow).toBeGreaterThanOrEqual(300);
    expect(result.restComplete).toBe(true);
    expect(result.slots.slot1 && result.slots.slot2).toBe(true);
  });

  it("30 min logged break stays rest for 5h (Jaydin-shaped: ~4.5h work, 30 min off, ~1.4h work)", () => {
    const events: AmiEvent[] = [
      { time: "2026-08-16T17:00:00", type: "work" },
      { time: "2026-08-16T21:30:00", type: "break" },
      { time: "2026-08-16T22:00:00", type: "work" },
      { time: "2026-08-16T23:24:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-08-16T23:30:00");
    const tape = buildEvalTape(events, asOf, 72 * 60);
    const result = evaluateFiveHourBreakRule(tape);
    expect(result.workMinutesInWindow).toBeGreaterThanOrEqual(300);
    expect(result.restComplete).toBe(true);
  });

  it("31 min logged break converted to non_work still covers 5h", () => {
    const events: AmiEvent[] = [
      { time: "2026-08-16T17:00:00", type: "work" },
      { time: "2026-08-16T21:30:00", type: "break" },
      { time: "2026-08-16T22:01:00", type: "work" },
      { time: "2026-08-16T23:24:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-08-16T23:30:00");
    const tape = buildEvalTape(events, asOf, 72 * 60);
    const result = evaluateFiveHourBreakRule(tape);
    expect(result.workMinutesInWindow).toBeGreaterThanOrEqual(300);
    expect(result.restComplete).toBe(true);
  });

  it("30 min non_work between work bouts covers 5h the same as a 30 min break", () => {
    const events: AmiEvent[] = [
      { time: "2026-08-16T17:00:00", type: "work" },
      { time: "2026-08-16T21:30:00", type: "stop" },
      { time: "2026-08-16T22:00:00", type: "work" },
      { time: "2026-08-16T23:24:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-08-16T23:30:00");
    const tape = buildEvalTape(events, asOf, 72 * 60);
    const result = evaluateFiveHourBreakRule(tape);
    expect(result.workMinutesInWindow).toBeGreaterThanOrEqual(300);
    expect(result.restComplete).toBe(true);
  });
});
