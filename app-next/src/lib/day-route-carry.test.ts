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
  it("never prompts — clock-today route confirm is a midnight cut", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
    ];
    expect(getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-04")).toBeNull();
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

  it("is true across an empty middle descriptor while the last event is still work", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
      {},
    ];
    expect(isTrueShiftContinuation(days, 4, WEEK_START, "2026-06-05")).toBe(true);
  });

  it("is false when the last prior event is End shift", () => {
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

  it("does not refill From/To from prior day when today has a run plan", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {
        truck_rego: "1ABC123",
        start_location: "",
        destination: "",
        route_label: "Northam loop",
        planned_on_duty_hours: 8,
        route_preset_id: "preset-northam",
      },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.start_location).toBe("");
    expect(wednesday.destination).toBe("");
    expect(wednesday.route_label).toBe("Northam loop");
  });

  it("walks back past an empty descriptor to the open shift's route", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const thursday = getDayWithCarriedOverCardInfo(days, 4, WEEK_START, "2026-06-05");
    expect(thursday.truck_rego).toBe("1ABC123");
    expect(thursday.start_location).toBe("Perth");
  });

  it("does not carry route after End shift", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([
        { time: TUESDAY_WORK, type: "work" },
        { time: "2026-06-03T22:00:00.000Z", type: "stop" },
      ]),
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.truck_rego).toBe("");
    expect(wednesday.start_location).toBe("");
  });

  it("does not copy start or end km onto the later label", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.start_kms).toBeUndefined();
    expect(wednesday.end_kms).toBeUndefined();
  });

  it("carries onto a later label even when clock-today is an earlier descriptor", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: TUESDAY_WORK, type: "work" }]),
      {},
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const thursday = getDayWithCarriedOverCardInfo(days, 4, WEEK_START, "2026-06-04");
    expect(thursday.truck_rego).toBe("1ABC123");
    expect(thursday.start_location).toBe("Perth");
  });
});
