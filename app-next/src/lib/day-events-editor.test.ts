import { describe, expect, it } from "vitest";
import { dayEventTypesForEditor } from "@/components/fatigue/DayEventsEditor";

describe("dayEventTypesForEditor", () => {
  it("keeps solo Edit day types without two-up events", () => {
    expect(dayEventTypesForEditor({ variant: "edit", twoUp: false })).toEqual([
      "work",
      "break",
      "other_work",
      "non_work",
      "stop",
    ]);
  });

  it("adds Passenger, Sleeper berth, and Parked on two-up Edit day", () => {
    expect(dayEventTypesForEditor({ variant: "edit", twoUp: true })).toEqual([
      "work",
      "break",
      "other_work",
      "passenger",
      "sleeper_berth",
      "stationary_rest",
      "non_work",
      "stop",
    ]);
  });

  it("adds two-up types on a new two-up shift setup", () => {
    expect(dayEventTypesForEditor({ variant: "new_shift", twoUp: true })).toEqual([
      "work",
      "break",
      "other_work",
      "passenger",
      "sleeper_berth",
      "stationary_rest",
    ]);
  });
});
