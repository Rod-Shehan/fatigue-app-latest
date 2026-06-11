import { describe, it, expect } from "vitest";
import {
  getSeventeenHourEpisodeStatus,
  MINUTES_17H_WORK_BREAK,
} from "./seventeen-hour-episode";
import type { RollingEvent } from "@/lib/rolling-events";

function ts(iso: string): number {
  return new Date(iso).getTime();
}

function ev(time: string, type: string, dayIndex = 0): RollingEvent {
  return { time, type, dayIndex };
}

describe("seventeen-hour-episode", () => {
  it("allows resume after End shift when still inside 17h work+break episode", () => {
    const events: RollingEvent[] = [
      ev("2026-06-10T18:00:00", "stop"),
      ev("2026-06-11T06:00:00", "work"),
      ev("2026-06-11T18:08:00", "stop"),
    ];
    const asOf = ts("2026-06-11T20:30:00");
    const status = getSeventeenHourEpisodeStatus(events, asOf);
    expect(status.withinSeventeenHourEpisode).toBe(true);
    expect(status.workBreakMinutesSinceAnchor).toBeLessThan(MINUTES_17H_WORK_BREAK);
    expect(status.canResumeWithoutSevenHourRest).toBe(true);
  });

  it("requires fresh rest when 17h work+break budget is exhausted", () => {
    const events: RollingEvent[] = [
      ev("2026-06-10T04:00:00", "stop"),
      ev("2026-06-10T12:00:00", "work"),
      ev("2026-06-11T05:30:00", "stop"),
    ];
    const asOf = ts("2026-06-11T07:00:00");
    const status = getSeventeenHourEpisodeStatus(events, asOf);
    expect(status.workBreakMinutesSinceAnchor).toBeGreaterThanOrEqual(MINUTES_17H_WORK_BREAK);
    expect(status.canResumeWithoutSevenHourRest).toBe(false);
  });

  it("does not offer resume when idle but never ended shift", () => {
    const events: RollingEvent[] = [ev("2026-06-11T06:00:00", "work")];
    const status = getSeventeenHourEpisodeStatus(events, ts("2026-06-11T10:00:00"));
    expect(status.canResumeWithoutSevenHourRest).toBe(false);
  });
});
