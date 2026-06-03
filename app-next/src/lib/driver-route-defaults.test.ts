import { describe, expect, it } from "vitest";
import {
  applyDriverRouteDefaultsToDay,
  applyRouteDefaultsToWeekDays,
  extractDriverRouteDefaults,
  findLastRouteDefaultsFromDays,
  mergeRouteDefaults,
} from "@/lib/driver-route-defaults";
import type { DayData } from "@/lib/api";

describe("driver-route-defaults", () => {
  it("extractDriverRouteDefaults omits kms", () => {
    const d = extractDriverRouteDefaults({
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Kal",
      start_kms: 100,
      end_kms: 500,
      planned_on_duty_hours: 9,
    });
    expect(d).toEqual({
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Kal",
      planned_on_duty_hours: 9,
    });
    expect(d).not.toHaveProperty("start_kms");
  });

  it("applyDriverRouteDefaultsToDay fills empty fields only", () => {
    const day: DayData = { truck_rego: "", start_location: "Mine", destination: "" };
    const out = applyDriverRouteDefaultsToDay(day, {
      truck_rego: "1XYZ",
      destination: "Depot",
      start_location: "Other",
    });
    expect(out.truck_rego).toBe("1XYZ");
    expect(out.start_location).toBe("Mine");
    expect(out.destination).toBe("Depot");
    expect(out.start_kms).toBeUndefined();
  });

  it("findLastRouteDefaultsFromDays scans backward", () => {
    const days: DayData[] = [
      { truck_rego: "OLD", start_location: "A", destination: "B" },
      {},
      { truck_rego: "NEW", start_location: "C", destination: "D" },
    ];
    expect(findLastRouteDefaultsFromDays(days, 3)?.truck_rego).toBe("NEW");
    expect(findLastRouteDefaultsFromDays(days, 2)?.truck_rego).toBe("OLD");
  });

  it("mergeRouteDefaults prefers in-week over stored", () => {
    const merged = mergeRouteDefaults(
      { truck_rego: "STORED", start_location: "S", destination: "D" },
      { truck_rego: "WEEK", start_location: "S", destination: "D" }
    );
    expect(merged?.truck_rego).toBe("WEEK");
  });

  it("applyRouteDefaultsToWeekDays updates today when empty", () => {
    const weekStarting = "2026-06-01"; // Sunday
    const todayYmd = "2026-06-03"; // Tuesday index 2
    const days: DayData[] = Array.from({ length: 7 }, () => ({}));
    days[1] = { truck_rego: "1ABC", start_location: "Perth", destination: "Kalgoorlie" };
    const { days: next, changed } = applyRouteDefaultsToWeekDays(
      days,
      weekStarting,
      todayYmd,
      null
    );
    expect(changed).toBe(true);
    expect(next[2]?.truck_rego).toBe("1ABC");
    expect(next[2]?.start_location).toBe("Perth");
    expect(next[2]?.start_kms).toBeUndefined();
  });
});
