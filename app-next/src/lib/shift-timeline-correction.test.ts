import { describe, expect, it } from "vitest";
import type { DayData } from "@/lib/api";
import {
  applyStopAtCorrectedTime,
  dayHasOpenWorkOrBreakSegment,
  END_SHIFT_ALREADY_ENDED_MESSAGE,
  findOpenWorkOrBreakOnTimeline,
  routeConfirmDayAfterPriorEndShift,
  timelineHasOpenWorkOrBreak,
  validateCorrectEndShiftTime,
} from "./shift-timeline-correction";
import { suggestedEndShiftTimeAfterLastEvent } from "./day-route-carry";

const SHEET_DAY = "2026-06-17";
const WORK_ISO = `${SHEET_DAY}T06:00:00`;
const AS_OF = new Date(`${SHEET_DAY}T18:00:00`).getTime();

function openWorkDay(): DayData {
  return {
    start_kms: 1000,
    events: [{ time: WORK_ISO, type: "work" }],
  };
}

describe("dayHasOpenWorkOrBreakSegment", () => {
  it("is true when last event is work", () => {
    expect(dayHasOpenWorkOrBreakSegment(openWorkDay())).toBe(true);
  });

  it("is false after stop", () => {
    expect(
      dayHasOpenWorkOrBreakSegment({
        events: [
          { time: WORK_ISO, type: "work" },
          { time: `${SHEET_DAY}T14:00:00`, type: "stop" },
        ],
      })
    ).toBe(false);
  });
});

describe("timelineHasOpenWorkOrBreak / findOpenWorkOrBreakOnTimeline", () => {
  it("finds open work on a prior day card when the current label has no events", () => {
    const days: DayData[] = [
      { events: [{ time: "2026-06-16T14:00:00.000Z", type: "work" }] },
      {}, // "today" label — empty events, but rolling work is still open
    ];
    const asOf = Date.parse("2026-06-17T02:00:00.000Z");
    expect(timelineHasOpenWorkOrBreak(days, asOf)).toBe(true);
    expect(findOpenWorkOrBreakOnTimeline(days, asOf)?.dayIndex).toBe(0);
  });

  it("is false after a stop later on the rolling timeline", () => {
    const days: DayData[] = [
      { events: [{ time: "2026-06-16T14:00:00.000Z", type: "work" }] },
      { events: [{ time: "2026-06-16T18:00:00.000Z", type: "stop" }] },
    ];
    const asOf = Date.parse("2026-06-17T02:00:00.000Z");
    expect(timelineHasOpenWorkOrBreak(days, asOf)).toBe(false);
    expect(findOpenWorkOrBreakOnTimeline(days, asOf)).toBeNull();
  });
});

describe("validateCorrectEndShiftTime", () => {
  it("accepts a time after the last event and before now", () => {
    const chosen = new Date(`${SHEET_DAY}T14:30:00`).toISOString();
    expect(validateCorrectEndShiftTime(openWorkDay(), SHEET_DAY, chosen, AS_OF)).toEqual({
      valid: true,
    });
  });

  it("rejects time before last event", () => {
    const chosen = new Date(`${SHEET_DAY}T05:00:00`).toISOString();
    const out = validateCorrectEndShiftTime(openWorkDay(), SHEET_DAY, chosen, AS_OF);
    expect(out.valid).toBe(false);
  });

  it("rejects future time", () => {
    const chosen = new Date(`${SHEET_DAY}T20:00:00`).toISOString();
    const out = validateCorrectEndShiftTime(openWorkDay(), SHEET_DAY, chosen, AS_OF);
    expect(out.valid).toBe(false);
  });

  it("uses rolling last-open time when the stop card has no open event", () => {
    const monday = "2026-06-17";
    const chosen = new Date(`${monday}T02:00:00`).toISOString();
    const asOf = new Date(`${monday}T03:00:00`).getTime();
    const out = validateCorrectEndShiftTime({}, monday, chosen, asOf, {
      lastOpenEventIso: "2026-06-16T14:00:00.000Z",
    });
    expect(out).toEqual({ valid: true });
  });
});

describe("applyStopAtCorrectedTime", () => {
  it("appends stop, sets end km, and clears assume_idle_from", () => {
    const days: DayData[] = [
      {
        ...openWorkDay(),
        assume_idle_from: new Date().toISOString(),
      },
    ];
    const stopIso = new Date(`${SHEET_DAY}T14:30:00`).toISOString();
    const next = applyStopAtCorrectedTime(days, 0, stopIso, 1250);
    expect(next[0]!.events).toHaveLength(2);
    expect(next[0]!.events![1]).toEqual({ time: stopIso, type: "stop" });
    expect(next[0]!.end_kms).toBe(1250);
    expect(next[0]!.assume_idle_from).toBeUndefined();
  });

  it("marks route confirmed on the following day when requested", () => {
    const days: DayData[] = [openWorkDay(), {}];
    const stopIso = suggestedEndShiftTimeAfterLastEvent(openWorkDay())!;
    const next = applyStopAtCorrectedTime(days, 0, stopIso, 1100, {
      markRouteConfirmedOnDayIndex: 1,
    });
    expect(next[1]!.route_confirmed).toBe(true);
  });
});

describe("routeConfirmDayAfterPriorEndShift", () => {
  it("returns today index when ending shift on the prior sheet day", () => {
    expect(routeConfirmDayAfterPriorEndShift(2, 3)).toBe(3);
  });

  it("returns undefined when ending on today", () => {
    expect(routeConfirmDayAfterPriorEndShift(3, 3)).toBeUndefined();
  });
});

describe("end-shift copy", () => {
  it("exposes already-ended messaging", () => {
    expect(END_SHIFT_ALREADY_ENDED_MESSAGE).toMatch(/already ended/i);
  });
});
