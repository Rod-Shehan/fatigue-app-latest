import { describe, expect, it } from "vitest";
import {
  catalogueSourceForSession,
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
});
