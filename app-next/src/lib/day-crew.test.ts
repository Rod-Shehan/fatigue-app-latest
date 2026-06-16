import { describe, expect, it } from "vitest";
import { formatDayCrewLabel, resolveDayCrew } from "@/lib/day-crew";

describe("resolveDayCrew", () => {
  it("prefers day-level crew over sheet fallback", () => {
    expect(
      resolveDayCrew({ driver_type: "two_up", second_driver: "Alex" }, { driver_type: "solo", second_driver: "" })
    ).toEqual({ driver_type: "two_up", second_driver: "Alex" });
  });

  it("falls back to sheet when day has no crew", () => {
    expect(resolveDayCrew({}, { driver_type: "two_up", second_driver: "Sam" })).toEqual({
      driver_type: "two_up",
      second_driver: "Sam",
    });
  });

  it("defaults to solo", () => {
    expect(resolveDayCrew(undefined, {})).toEqual({ driver_type: "solo", second_driver: "" });
  });
});

describe("formatDayCrewLabel", () => {
  it("formats solo and two-up", () => {
    expect(formatDayCrewLabel({ driver_type: "solo", second_driver: "" })).toBe("Solo");
    expect(formatDayCrewLabel({ driver_type: "two_up", second_driver: "Alex" })).toBe("Two-Up · Alex");
  });
});
