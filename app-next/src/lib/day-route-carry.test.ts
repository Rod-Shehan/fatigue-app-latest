import { describe, expect, it } from "vitest";
import type { DayData } from "@/lib/api";
import { getContinuedShiftRoutePrompt, getDayWithCarriedOverCardInfo } from "./day-route-carry";

const WEEK_START = "2026-06-01"; // Sunday

function dayWithOpenWork(events: { time: string; type: string }[]): DayData {
  return {
    truck_rego: "1ABC123",
    start_location: "Perth",
    destination: "Kalgoorlie",
    start_kms: 1000,
    events,
  };
}

describe("getContinuedShiftRoutePrompt", () => {
  it("does not prompt on a future day while the previous day still has open work", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: "2026-06-03T22:00:00.000Z", type: "work" }]), // Tuesday
      {}, // Wednesday — not today yet
    ];
    expect(
      getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-03")
    ).toBeNull();
  });

  it("prompts on the day the shift rolled into (present tense)", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: "2026-06-03T22:00:00.000Z", type: "work" }]), // Tuesday
      {}, // Wednesday is today
    ];
    expect(
      getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-04")
    ).toEqual({ previousDayName: "Tuesday" });
  });

  it("does not prompt after route is confirmed", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: "2026-06-03T22:00:00.000Z", type: "work" }]),
      { route_confirmed: true },
    ];
    expect(
      getContinuedShiftRoutePrompt(days, 3, WEEK_START, "2026-06-04")
    ).toBeNull();
  });
});

describe("getDayWithCarriedOverCardInfo", () => {
  it("does not carry route fields onto a future calendar day", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: "2026-06-03T22:00:00.000Z", type: "work" }]),
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-03");
    expect(wednesday.truck_rego).toBe("");
    expect(wednesday.start_location).toBe("");
  });

  it("carries route fields once that calendar day has started", () => {
    const days: DayData[] = [
      {},
      {},
      dayWithOpenWork([{ time: "2026-06-03T22:00:00.000Z", type: "work" }]),
      { truck_rego: "", start_location: "", destination: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.truck_rego).toBe("1ABC123");
    expect(wednesday.start_location).toBe("Perth");
    expect(wednesday.destination).toBe("Kalgoorlie");
  });

  it("carries previous day end km as start km hint when continuing overnight", () => {
    const days: DayData[] = [
      {},
      {},
      { ...dayWithOpenWork([{ time: "2026-06-03T22:00:00.000Z", type: "work" }]), end_kms: 1325200 },
      { truck_rego: "" },
    ];
    const wednesday = getDayWithCarriedOverCardInfo(days, 3, WEEK_START, "2026-06-04");
    expect(wednesday.start_kms).toBe(1325200);
  });
});
