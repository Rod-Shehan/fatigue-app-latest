import { describe, expect, it } from "vitest";
import {
  catalogueSourceForSession,
  dayCardFieldsFromPreset,
  parseRouteLabelToLocations,
  routeSourceForCatalogue,
  runPlanFieldsFromPreset,
  validateRoutePresetCreateInput,
} from "./route-preset";

describe("route-preset", () => {
  it("maps catalogue source to day route_source", () => {
    expect(routeSourceForCatalogue("fleet")).toBe("org_preset");
    expect(routeSourceForCatalogue("driver")).toBe("driver_saved");
  });

  it("defaults catalogue source by role", () => {
    expect(catalogueSourceForSession(true)).toBe("fleet");
    expect(catalogueSourceForSession(false)).toBe("driver");
  });

  it("validates preset create like run plan", () => {
    expect(validateRoutePresetCreateInput({ label: "" })).toMatch(/required/i);
    expect(
      validateRoutePresetCreateInput({ label: "Perth loop", planned_on_duty_hours: 8 })
    ).toBeNull();
  });

  it("applies preset to run plan fields", () => {
    const fields = runPlanFieldsFromPreset({
      id: "p1",
      label: "Kalgoorlie",
      start_location: null,
      destination: null,
      planned_distance_km: 600,
      planned_on_duty_hours: 10,
      catalogue_source: "fleet",
      created_by_name: null,
      sort_order: 0,
    });
    expect(fields.route_preset_id).toBe("p1");
    expect(fields.route_source).toBe("org_preset");
    expect(fields.route_label).toBe("Kalgoorlie");
  });

  it("parses route labels into from/to", () => {
    expect(parseRouteLabelToLocations("Perth – Kalgoorlie")).toEqual({
      start_location: "Perth",
      destination: "Kalgoorlie",
    });
    expect(parseRouteLabelToLocations("Perth to Kalgoorlie")).toEqual({
      start_location: "Perth",
      destination: "Kalgoorlie",
    });
    expect(parseRouteLabelToLocations("Loop")).toEqual({ destination: "Loop" });
  });

  it("dayCardFieldsFromPreset prefers explicit locations over parsed label", () => {
    const fields = dayCardFieldsFromPreset({
      id: "p2",
      label: "Perth – Kalgoorlie",
      start_location: "Fremantle",
      destination: "Leonora",
      planned_distance_km: 420,
      planned_on_duty_hours: 9,
      catalogue_source: "driver",
      created_by_name: null,
      sort_order: 0,
    });
    expect(fields.start_location).toBe("Fremantle");
    expect(fields.destination).toBe("Leonora");
    expect(fields.route_source).toBe("driver_saved");
  });

  it("dayCardFieldsFromPreset falls back to parsed label", () => {
    const fields = dayCardFieldsFromPreset({
      id: "p3",
      label: "Perth – Kalgoorlie",
      start_location: null,
      destination: null,
      planned_distance_km: null,
      planned_on_duty_hours: 8,
      catalogue_source: "fleet",
      created_by_name: null,
      sort_order: 0,
    });
    expect(fields.start_location).toBe("Perth");
    expect(fields.destination).toBe("Kalgoorlie");
  });

  it("dayCardFieldsFromPreset clears From when label has no from/to pair", () => {
    const fields = dayCardFieldsFromPreset({
      id: "p4",
      label: "Northam loop",
      start_location: null,
      destination: null,
      planned_distance_km: 120,
      planned_on_duty_hours: 6,
      catalogue_source: "fleet",
      created_by_name: null,
      sort_order: 0,
    });
    // Always strings so draft spread overwrites a prior trip's From/To.
    expect(fields.start_location).toBe("");
    expect(fields.destination).toBe("Northam loop");
  });

  it("dayCardFieldsFromPreset returns empty strings when no place can be inferred", () => {
    const fields = dayCardFieldsFromPreset({
      id: "p5",
      label: "   ",
      start_location: null,
      destination: null,
      planned_distance_km: null,
      planned_on_duty_hours: 8,
      catalogue_source: "driver",
      created_by_name: null,
      sort_order: 0,
    });
    expect(fields.start_location).toBe("");
    expect(fields.destination).toBe("");
  });
});
