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
  it("does not prompt when today has no work/break (forgot End shift — not a continuation)", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-04")).toBeNull();
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
});

describe("getPriorDayUnclosedShiftPrompt", () => {
  it("prompts when prior day open and today has no work/break events", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(getPriorDayUnclosedShiftPrompt(days, 3, WEEK_START, "2026-06-04")).toEqual({
      previousDayName: "Tuesday",
      previousDayIndex: 2,
    });
  });
});

describe("isTrueShiftContinuation", () => {
  it("is false when only prior day is open", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(isTrueShiftContinuation(days, 3, WEEK_START, "2026-06-04")).toBe(false);
  });
});

describe("getDayWithCarriedOverCardInfo", () => {
  it("does not carry route when today has no work/break", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.truck_rego).toBe("");
  });
});
