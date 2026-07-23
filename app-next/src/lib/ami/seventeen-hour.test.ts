import { describe, expect, it } from "vitest";
import {
  AMI_17H_WORK_BREAK_CEILING,
  evaluateSeventeenHourEpisode,
  evaluateSoloBetweenShiftRest,
  type AmiEvent,
} from "./index";

describe("AMI 17h episode + solo between-shift", () => {
  it("allows resume after stop inside active 17h episode (no fresh 7h)", () => {
    // stop → ≥7h gap → work → stop (same pattern as live seventeen-hour-episode tests)
    const events: AmiEvent[] = [
      { time: "2026-06-10T18:00:00", type: "stop" },
      { time: "2026-06-11T06:00:00", type: "work" },
      { time: "2026-06-11T18:08:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-06-11T20:30:00");
    const episode = evaluateSeventeenHourEpisode(events, asOf);
    expect(episode.withinSeventeenHourEpisode).toBe(true);
    expect(episode.workBreakMinutesSinceAnchor).toBeLessThan(AMI_17H_WORK_BREAK_CEILING);
    expect(episode.canResumeWithoutSevenHourRest).toBe(true);

    const rest = evaluateSoloBetweenShiftRest(events, asOf);
    expect(rest.waivedBySeventeenHourResume).toBe(true);
    expect(rest.met).toBe(true);
  });

  it("does not waive when 17h work+break budget is exhausted", () => {
    const events: AmiEvent[] = [
      { time: "2026-06-10T04:00:00", type: "stop" },
      { time: "2026-06-10T12:00:00", type: "work" },
      { time: "2026-06-11T05:30:00", type: "stop" },
    ];
    const asOf = Date.parse("2026-06-11T07:00:00");
    const episode = evaluateSeventeenHourEpisode(events, asOf);
    expect(episode.workBreakMinutesSinceAnchor).toBeGreaterThanOrEqual(AMI_17H_WORK_BREAK_CEILING);
    expect(episode.canResumeWithoutSevenHourRest).toBe(false);
  });

  it("does not offer resume when idle but never ended shift", () => {
    const events: AmiEvent[] = [{ time: "2026-06-11T06:00:00", type: "work" }];
    const episode = evaluateSeventeenHourEpisode(events, Date.parse("2026-06-11T10:00:00"));
    expect(episode.canResumeWithoutSevenHourRest).toBe(false);
  });
});
