import { describe, expect, it } from "vitest";
import type { DayData } from "@/lib/api";
import {
  closePriorDayShiftAfterLastEvent,
  getContinuedShiftRoutePrompt,
  getDayWithCarriedOverCardInfo,
  getPriorDayUnclosedShiftPrompt,
  isTrueShiftContinuation,
  suggestedEndShiftTimeAfterLastEvent,
} from "./day-route-carry";

const WEEK_START = "2026-06-01"; // Sunday

const TUESDAY_WORK = "2026-06-03T18:30:00.000Z";

function dayWithOpenWork(events: { time: string; type: string }[]): DayData {
  return {
    truck_rego: "1ABC123",
    start_location: "Perth",
    destination: "Kalgoorlie",
    start_kms: 1000,
    events,
  };
}

describe("suggestedEndShiftTimeAfterLastEvent", () => {
  it("is one minute after the last work event", () => {
    const iso = suggestedEndShiftTimeAfterLastEvent(
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }])
    );
    expect(iso).toBe(new Date(new Date(TUESDAY_WORK).getTime() + 60_000).toISOString());
  });
});

describe("closePriorDayShiftAfterLastEvent", () => {
  it("appends stop after last event, not at next-day midnight", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    const next = closePriorDayShiftAfterLastEvent(days, 3);
    const stop = next[2]!.events!.find((e) => e.type === "stop");
    expect(stop).toBeDefined();
    const stopMs = new Date(stop!.time).getTime();
    const workMs = new Date(TUESDAY_WORK).getTime();
    expect(stopMs).toBe(workMs + 60_000);
    expect(stopMs - workMs).toBeLessThan(24 * 3600_000);
    expect(next[3]!.route_confirmed).toBe(true);
  });
});

describe("getContinuedShiftRoutePrompt", () => {
  it("prompts when prior day is still open — even if today has no work/break yet", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-04")).toEqual({
      previousDayName: "Tuesday",
    });
  });

  it("prompts when prior day open and driver logged work today", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      { events: [{ time: "2026-06-04T06:00:00.000Z", type: "work" }] },
    ];
    expect(getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-04")).toEqual({
      previousDayName: "Tuesday",
    });
  });

  it("does not prompt on a future day while the previous day still has open work", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-03")).toBeNull();
  });
});

describe("getPriorDayUnclosedShiftPrompt", () => {
  it("never prompts — open prior day is rolling continuation, not a calendar end-shift debt", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(getPriorDayUnclosedShiftPrompt(days, 3, WEEK_START, "2026-06-04")).toBeNull();
  });
});

describe("isTrueShiftContinuation", () => {
  it("is true when prior day is open even if today has no work/break yet", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(isTrueShiftContinuation(days, 3, WEEK_START, "2026-06-04")).toBe(true);
  });

  it("is false when prior day ended with End shift", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([
        { time: TUESDAY_WORK, type: "work" },
        { time: "2026-06-03T22:00:00.000Z", type: "stop" },
      ]),
      {},
    ];
    expect(isTrueShiftContinuation(days, 3, WEEK_START, "2026-06-04")).toBe(false);
  });
});

describe("getDayWithCarriedOverCardInfo", () => {
  it("carries route when prior day is open even if today has no work/break yet", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.truck_rego).toBe("1ABC123");
    expect(wednesday.start_location).toBe("Perth");
    expect(wednesday.destination).toBe("Kalgoorlie");
  });
});
