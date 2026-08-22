/** RULE IP — owner approval required before changing expected rule outcomes. See .cursor/rules/time-rules-ip.mdc */
import { describe, it, expect } from "vitest";
import {
  concatenateTimelineSlices,
  getEventsInTimeOrder,
  getLastStopTime,
  getNonWorkHoursSinceLastStop,
  getLastShiftEndTime,
  getNonWorkHoursSinceLastShiftEnd,
  getNonWorkMinutesSinceLastShiftEnd,
  getShiftRestStatusFromTimeline,
  getInsufficientNonWorkMessage,
  getInsufficientTwoUp24hNonWorkMessage,
  getSheetOwnerEventsInOrder,
  getTwoUpRolling24hRestStatus,
  type RollingEvent,
} from "./rolling-events";

function ts(iso: string): number {
  return new Date(iso).getTime();
}

describe("rolling-events", () => {
  describe("getEventsInTimeOrder", () => {
    it("returns empty array when no days or no events", () => {
      expect(getEventsInTimeOrder([])).toEqual([]);
      expect(getEventsInTimeOrder([{}, {}])).toEqual([]);
      expect(getEventsInTimeOrder([{ events: [] }])).toEqual([]);
    });

    it("returns one event with dayIndex when one day has one event", () => {
      const days = [{ events: [{ time: "2025-02-17T08:00:00.000Z", type: "work" }] }];
      expect(getEventsInTimeOrder(days)).toEqual([
        { time: "2025-02-17T08:00:00.000Z", type: "work", dayIndex: 0 },
      ]);
    });

    it("sorts events by time across days", () => {
      const days = [
        { events: [{ time: "2025-02-18T10:00:00.000Z", type: "work" }] },
        { events: [{ time: "2025-02-17T08:00:00.000Z", type: "stop" }] },
        { events: [{ time: "2025-02-19T09:00:00.000Z", type: "break" }] },
      ];
      const out = getEventsInTimeOrder(days);
      expect(out.map((e) => e.time)).toEqual([
        "2025-02-17T08:00:00.000Z",
        "2025-02-18T10:00:00.000Z",
        "2025-02-19T09:00:00.000Z",
      ]);
      expect(out[0].dayIndex).toBe(1);
      expect(out[1].dayIndex).toBe(0);
      expect(out[2].dayIndex).toBe(2);
    });

    it("merges multiple events from same day in time order", () => {
      const days = [
        {
          events: [
            { time: "2025-02-17T14:00:00.000Z", type: "break" },
            { time: "2025-02-17T08:00:00.000Z", type: "work" },
            { time: "2025-02-17T20:00:00.000Z", type: "stop" },
          ],
        },
      ];
      const out = getEventsInTimeOrder(days);
      expect(out.map((e) => e.time)).toEqual([
        "2025-02-17T08:00:00.000Z",
        "2025-02-17T14:00:00.000Z",
        "2025-02-17T20:00:00.000Z",
      ]);
    });
  });

  describe("getLastStopTime", () => {
    it("returns null when no events", () => {
      expect(getLastStopTime([])).toBeNull();
    });

    it("returns null when no stop event", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T08:00:00.000Z", type: "work", dayIndex: 0 },
        { time: "2025-02-17T13:00:00.000Z", type: "break", dayIndex: 0 },
      ];
      expect(getLastStopTime(events)).toBeNull();
    });

    it("returns last stop time in ms when one stop", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T08:00:00.000Z", type: "work", dayIndex: 0 },
        { time: "2025-02-17T18:00:00.000Z", type: "stop", dayIndex: 0 },
      ];
      expect(getLastStopTime(events)).toBe(ts("2025-02-17T18:00:00.000Z"));
    });

    it("returns latest stop before optional cutoff", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T08:00:00.000Z", type: "stop", dayIndex: 0 },
        { time: "2025-02-18T08:00:00.000Z", type: "work", dayIndex: 1 },
        { time: "2025-02-18T18:00:00.000Z", type: "stop", dayIndex: 1 },
      ];
      const before = ts("2025-02-18T12:00:00.000Z");
      expect(getLastStopTime(events, before)).toBe(ts("2025-02-17T08:00:00.000Z"));
      expect(getLastStopTime(events)).toBe(ts("2025-02-18T18:00:00.000Z"));
    });
  });

  describe("getNonWorkHoursSinceLastStop", () => {
    it("returns null when no stop", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T08:00:00.000Z", type: "work", dayIndex: 0 },
      ];
      expect(getNonWorkHoursSinceLastStop(events, ts("2025-02-17T20:00:00.000Z"))).toBeNull();
    });

    it("returns non-work hours since last stop as of asOfMs", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T08:00:00.000Z", type: "work", dayIndex: 0 },
        { time: "2025-02-17T18:00:00.000Z", type: "stop", dayIndex: 0 },
      ];
      const asOf = ts("2025-02-18T01:00:00.000Z"); // 7h after stop
      expect(getNonWorkHoursSinceLastStop(events, asOf)).toBe(7);
    });

    it("returns 5 when stop was 5h ago (insufficient for 7h rule)", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T18:00:00.000Z", type: "stop", dayIndex: 0 },
      ];
      const asOf = ts("2025-02-17T23:00:00.000Z"); // 5h later
      expect(getNonWorkHoursSinceLastStop(events, asOf)).toBe(5);
    });
  });

  describe("getInsufficientNonWorkMessage", () => {
    it("returns null when no stop (no last shift)", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T08:00:00.000Z", type: "work", dayIndex: 0 },
      ];
      expect(getInsufficientNonWorkMessage(events, ts("2025-02-17T20:00:00.000Z"))).toBeNull();
    });

    it("returns null when non-work time >= 7h", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T18:00:00.000Z", type: "stop", dayIndex: 0 },
      ];
      const asOf = ts("2025-02-18T02:00:00.000Z"); // 8h later
      expect(getInsufficientNonWorkMessage(events, asOf)).toBeNull();
    });

    it("returns message when non-work time < 7h", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T18:00:00.000Z", type: "stop", dayIndex: 0 },
      ];
      const asOf = ts("2025-02-17T23:00:00.000Z"); // 5h later
      const msg = getInsufficientNonWorkMessage(events, asOf);
      expect(msg).toContain("Less than 7 hours");
      expect(msg).toContain("non-work time requirements");
    });

    it("uses custom minNonWorkHours when provided", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T18:00:00.000Z", type: "stop", dayIndex: 0 },
      ];
      const asOf = ts("2025-02-18T00:00:00.000Z"); // 6h later
      expect(getInsufficientNonWorkMessage(events, asOf, 5)).toBeNull();
      expect(getInsufficientNonWorkMessage(events, asOf, 7)).not.toBeNull();
    });
  });

  describe("getShiftRestStatusFromTimeline", () => {
    it("returns null when no shift end on the timeline", () => {
      const events: RollingEvent[] = [
        { time: "2026-06-11T14:00:00", type: "work", dayIndex: 0 },
      ];
      expect(getShiftRestStatusFromTimeline(events, ts("2026-06-11T19:00:00"))).toBeNull();
    });

    it("measures rolling minutes since last stop only", () => {
      const events: RollingEvent[] = [
        { time: "2026-06-11T14:00:00", type: "work", dayIndex: 0 },
        { time: "2026-06-11T16:08:00", type: "stop", dayIndex: 0 },
      ];
      const out = getShiftRestStatusFromTimeline(events, ts("2026-06-11T19:40:00"), {
        allowSeventeenHourEpisodeResume: false,
      });
      expect(out).not.toBeNull();
      expect(out!.consecutiveNonWorkMinutes).toBeGreaterThanOrEqual(200);
      expect(out!.consecutiveNonWorkMinutes).toBeLessThan(240);
      expect(out!.restRunStartedAtMs).toBe(ts("2026-06-11T16:08:00"));
    });

    it("skips 7h gate when solo resume is inside active 17h episode", () => {
      const events: RollingEvent[] = [
        { time: "2026-06-10T18:00:00", type: "stop", dayIndex: 0 },
        { time: "2026-06-11T06:00:00", type: "work", dayIndex: 1 },
        { time: "2026-06-11T18:08:00", type: "stop", dayIndex: 1 },
      ];
      expect(getShiftRestStatusFromTimeline(events, ts("2026-06-11T20:30:00"))).toBeNull();
    });

    it("finds shift end across older record slices (not current slice only)", () => {
      const prior = [
        {
          events: [{ time: "2026-06-10T18:00:00", type: "stop" }],
        },
      ];
      const current = [{ events: [] }];
      const events = getEventsInTimeOrder(concatenateTimelineSlices(prior, current));
      const mins = getNonWorkMinutesSinceLastShiftEnd(events, ts("2026-06-11T10:00:00"));
      expect(mins).toBe(16 * 60);
    });
  });

  describe("shift-end non-work markers", () => {
    it("treats non_work as a shift end marker for recovery window", () => {
      const events: RollingEvent[] = [
        { time: "2025-02-17T10:00:00.000Z", type: "work", dayIndex: 0 },
        { time: "2025-02-17T18:00:00.000Z", type: "non_work", dayIndex: 0 },
      ];
      const asOf = ts("2025-02-18T01:00:00.000Z"); // 7h after non_work
      expect(getLastShiftEndTime(events)).toBe(ts("2025-02-17T18:00:00.000Z"));
      expect(getNonWorkHoursSinceLastShiftEnd(events, asOf)).toBe(7);
      expect(getInsufficientNonWorkMessage(events, asOf)).toBeNull();
    });
  });

  describe("getSheetOwnerEventsInOrder", () => {
    it("excludes legacy second-driver work from owner timeline", () => {
      const days = [
        {
          events: [
            { time: "2026-06-11T08:00:00", type: "work" },
            { time: "2026-06-11T10:00:00", type: "work", driver: "second" as const },
          ],
        },
      ];
      const events = getSheetOwnerEventsInOrder(days);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("work");
    });
  });

  describe("getTwoUpRolling24hRestStatus", () => {
    it("returns null when no work/break in rolling 24h", () => {
      const events = [{ time: "2026-06-11T08:00:00", type: "non_work" }];
      expect(getTwoUpRolling24hRestStatus(events, ts("2026-06-11T20:00:00"))).toBeNull();
    });

    it("returns shortfall when work fills rolling 24h with no non-work", () => {
      const events = [{ time: "2026-06-10T06:00:00", type: "work" }];
      const asOf = ts("2026-06-11T06:00:00");
      const status = getTwoUpRolling24hRestStatus(events, asOf);
      expect(status).not.toBeNull();
      expect(status!.nonWorkMinutesShortfall).toBe(7 * 60);
      expect(getInsufficientTwoUp24hNonWorkMessage(events, asOf)).toContain("rolling 24-hour");
    });

    it("returns null when rolling 24h has at least 7h non-work with work in window", () => {
      const events = [
        { time: "2026-06-10T20:00:00", type: "work" },
        { time: "2026-06-10T22:00:00", type: "stop" },
      ];
      const asOf = ts("2026-06-11T14:00:00"); // 16h non-work since stop
      expect(getTwoUpRolling24hRestStatus(events, asOf)).toBeNull();
    });

    it("does not count passenger time as non-work (never converts)", () => {
      const events = [
        { time: "2026-06-09T18:00:00", type: "work" },
        { time: "2026-06-10T10:00:00", type: "passenger" },
      ];
      const asOf = ts("2026-06-10T18:00:00");
      const status = getTwoUpRolling24hRestStatus(events, asOf);
      expect(status).not.toBeNull();
      expect(status!.nonWorkMinutes).toBe(0);
      expect(status!.nonWorkMinutesShortfall).toBe(7 * 60);
    });

    it("counts sleeper berth as non-work during an open shift", () => {
      const met = [
        { time: "2026-06-09T18:00:00", type: "work" },
        { time: "2026-06-10T11:00:00", type: "sleeper_berth" },
      ];
      expect(getTwoUpRolling24hRestStatus(met, ts("2026-06-10T18:00:00"))).toBeNull();

      const short = [
        { time: "2026-06-09T18:00:00", type: "work" },
        { time: "2026-06-10T12:00:00", type: "sleeper_berth" },
      ];
      const status = getTwoUpRolling24hRestStatus(short, ts("2026-06-10T18:00:00"));
      expect(status).not.toBeNull();
      expect(status!.nonWorkMinutes).toBe(6 * 60);
      expect(status!.nonWorkMinutesShortfall).toBe(60);
    });
  });
});
