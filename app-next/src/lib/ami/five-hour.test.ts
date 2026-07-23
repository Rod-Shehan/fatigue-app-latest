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
});
