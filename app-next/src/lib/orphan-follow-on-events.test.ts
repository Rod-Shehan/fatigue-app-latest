import { describe, expect, it } from "vitest";
import {
  dayHasFollowOnActivity,
  findNewlyAddedStopIso,
  formatOrphanFollowOnClearedMessage,
  pruneOrphanFollowOnEventsAfterStop,
} from "@/lib/orphan-follow-on-events";
import type { DayData } from "@/lib/api";

describe("orphan-follow-on-events", () => {
  it("findNewlyAddedStopIso returns the new stop time", () => {
    const before: DayData = {
      events: [{ time: "2026-06-06T22:00:00.000Z", type: "work" }],
    };
    const after: DayData = {
      events: [
        { time: "2026-06-06T22:00:00.000Z", type: "work" },
        { time: "2026-06-06T23:30:00.000Z", type: "stop" },
      ],
    };
    expect(findNewlyAddedStopIso(before, after)).toBe("2026-06-06T23:30:00.000Z");
  });

  it("pruneOrphanFollowOnEventsAfterStop removes Sunday work after Saturday stop", () => {
    const days: DayData[] = Array.from({ length: 7 }, () => ({ events: [] }));
    days[6] = {
      events: [
        { time: "2026-06-06T14:00:00.000Z", type: "work" },
        { time: "2026-06-06T23:00:00.000Z", type: "stop" },
      ],
    };
    // Simulate next-week Sunday as day 0 on another array — same function on one week:
    const weekB: DayData[] = Array.from({ length: 7 }, () => ({ events: [] }));
    weekB[0] = {
      events: [{ time: "2026-06-07T06:00:00.000Z", type: "work" }],
    };
    const stopIso = "2026-06-06T23:00:00.000Z";
    const pruned = pruneOrphanFollowOnEventsAfterStop(weekB, stopIso);
    expect(pruned.removed).toHaveLength(1);
    expect(pruned.removed[0]?.type).toBe("work");
    expect(pruned.removed[0]?.dayName).toBe("Sunday");
    expect(pruned.days[0]?.events ?? []).toHaveLength(0);
  });

  it("pruneOrphanFollowOnEventsAfterStop keeps events after a later intentional stop bout ends", () => {
    const days: DayData[] = Array.from({ length: 7 }, () => ({ events: [] }));
    days[0] = {
      events: [
        { time: "2026-06-07T06:00:00.000Z", type: "work" },
        { time: "2026-06-07T10:00:00.000Z", type: "stop" },
        { time: "2026-06-07T18:00:00.000Z", type: "work" },
      ],
    };
    const pruned = pruneOrphanFollowOnEventsAfterStop(days, "2026-06-06T23:00:00.000Z");
    expect(pruned.days[0]?.events?.map((e) => e.type)).toEqual(["work"]);
    expect(pruned.days[0]?.events?.[0]?.time).toBe("2026-06-07T18:00:00.000Z");
  });

  it("formatOrphanFollowOnClearedMessage names the day and type", () => {
    expect(
      formatOrphanFollowOnClearedMessage([
        { dayIndex: 0, dayName: "Sunday", time: "t", type: "work" },
      ])
    ).toBe("Removed Sunday Work that belonged to the shift you just ended.");
  });

  it("formatOrphanFollowOnClearedMessage reports paint-only clear", () => {
    expect(formatOrphanFollowOnClearedMessage([], { paintCleared: true })).toBe(
      "Cleared continued work on the next day that belonged to the shift you just ended."
    );
  });

  it("dayHasFollowOnActivity detects events and painted work", () => {
    expect(dayHasFollowOnActivity({ events: [{ time: "t", type: "work" }] })).toBe(true);
    expect(dayHasFollowOnActivity({ work_time: [true] })).toBe(true);
    expect(dayHasFollowOnActivity({ events: [], work_time: [false] })).toBe(false);
  });
});
