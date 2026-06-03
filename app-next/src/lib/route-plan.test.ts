import { describe, expect, it } from "vitest";
import { formatRunPlanSummary, runPlanValidationError } from "@/lib/route-plan";

describe("route-plan", () => {
  it("requires label and distance or time when plan started", () => {
    expect(runPlanValidationError({ planned_on_duty_hours: 8 })).toMatch(/Route name/);
    expect(runPlanValidationError({ route_label: "Run A" })).toMatch(/distance|hours/i);
    expect(runPlanValidationError({ route_label: "Run A", planned_on_duty_hours: 9 })).toBeNull();
  });

  it("formats summary", () => {
    expect(
      formatRunPlanSummary({ route_label: "Kal", planned_on_duty_hours: 9, planned_distance_km: 400 })
    ).toBe("Kal · ~9h · ~400 km");
  });
});
