import { describe, expect, it } from "vitest";
import {
  applyDriverRouteDefaultsToDay,
  applyRouteDefaultsToWeekDays,
  extractDriverRouteDefaults,
  findLastRouteDefaultsFromDays,
  inferRouteCarryMode,
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
      route_label: "Perth run",
    });
    expect(d).toEqual({
      carry_mode: "run_plan",
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Kal",
      route_label: "Perth run",
      planned_on_duty_hours: 9,
    });
    expect(d).not.toHaveProperty("start_kms");
  });

  it("extractDriverRouteDefaults manual mode omits run plan fields", () => {
    const d = extractDriverRouteDefaults({
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Albany",
    });
    expect(d).toEqual({
      carry_mode: "manual",
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Albany",
    });
    expect(d).not.toHaveProperty("route_label");
    expect(d).not.toHaveProperty("planned_on_duty_hours");
  });

  it("inferRouteCarryMode prefers catalogue preset", () => {
    expect(
      inferRouteCarryMode({
        start_location: "Perth",
        destination: "Albany",
        route_preset_id: "preset-1",
        route_label: "Northam",
      })
    ).toBe("run_plan");
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

  it("applyDriverRouteDefaultsToDay does not refill places when run plan is set", () => {
    const day: DayData = {
      truck_rego: "1ABC",
      start_location: "",
      destination: "",
      route_label: "Northam loop",
      planned_on_duty_hours: 8,
      route_preset_id: "preset-northam",
    };
    const out = applyDriverRouteDefaultsToDay(day, {
      carry_mode: "run_plan",
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Kalgoorlie",
      route_label: "Old Perth–Kal",
      planned_on_duty_hours: 10,
    });
    expect(out.start_location).toBe("");
    expect(out.destination).toBe("");
    expect(out.route_label).toBe("Northam loop");
    expect(out.route_preset_id).toBe("preset-northam");
  });

  it("applyDriverRouteDefaultsToDay still fills places when day has no plan", () => {
    const day: DayData = { truck_rego: "", start_location: "", destination: "" };
    const out = applyDriverRouteDefaultsToDay(day, {
      carry_mode: "run_plan",
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Kalgoorlie",
      route_label: "Perth – Kalgoorlie",
      planned_on_duty_hours: 10,
    });
    expect(out.start_location).toBe("Perth");
    expect(out.destination).toBe("Kalgoorlie");
    expect(out.route_label).toBe("Perth – Kalgoorlie");
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
      {
        carry_mode: "run_plan",
        truck_rego: "STORED",
        start_location: "S",
        destination: "D",
        route_label: "Northam",
        planned_on_duty_hours: 10,
      },
      { carry_mode: "manual", truck_rego: "WEEK", start_location: "Perth", destination: "Albany" }
    );
    expect(merged?.truck_rego).toBe("WEEK");
    expect(merged?.carry_mode).toBe("manual");
    expect(merged).not.toHaveProperty("route_label");
  });

  it("applyDriverRouteDefaultsToDay manual mode does not carry run plan", () => {
    const day: DayData = {};
    const out = applyDriverRouteDefaultsToDay(day, {
      carry_mode: "manual",
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Albany",
    });
    expect(out.start_location).toBe("Perth");
    expect(out.route_label).toBeUndefined();
    expect(out.planned_on_duty_hours).toBeUndefined();
  });

  it("applyDriverRouteDefaultsToDay manual mode clears stale run plan", () => {
    const day: DayData = {
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Albany",
      route_label: "Northam",
      planned_on_duty_hours: 10,
      planned_distance_km: 500,
    };
    const out = applyDriverRouteDefaultsToDay(day, {
      carry_mode: "manual",
      truck_rego: "1ABC",
      start_location: "Perth",
      destination: "Albany",
    });
    expect(out.route_label).toBeUndefined();
    expect(out.planned_on_duty_hours).toBeUndefined();
    expect(out.planned_distance_km).toBeUndefined();
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
