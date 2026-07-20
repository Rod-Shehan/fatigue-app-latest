import { describe, expect, it } from "vitest";
import {
  isComplianceFixActionable,
  isComplianceMessageFixableInDaySetup,
  resolveComplianceFixRoute,
  resolvePrimaryComplianceFixRoute,
} from "@/lib/compliance-fix-routes";

describe("compliance-fix-routes", () => {
  it("routes 2×24h to set up week record", () => {
    const route = resolveComplianceFixRoute({
      message: "Need ≥2×24h continuous non-work in any 14-day period",
      type: "warning",
    });
    expect(route.kind).toBe("setup_week_record");
    expect(route.driverLabel).toBe("Set up week record");
    expect(isComplianceMessageFixableInDaySetup("Need ≥2×24h continuous non-work")).toBe(true);
  });

  it("routes 168h breach to review only", () => {
    const route = resolveComplianceFixRoute({
      message: "14-day work exceeds 168h",
      type: "violation",
    });
    expect(route.kind).toBe("review_only");
    expect(isComplianceFixActionable(route)).toBe(false);
  });

  it("routes 5h break warning to edit day", () => {
    const route = resolveComplianceFixRoute({
      message: "20 min rest per 5h work (2×10 min or 1×20 min)",
      type: "warning",
      day: "Tue",
    });
    expect(route.kind).toBe("edit_day");
    expect(route.scrollDayIndex).toBe(2);
  });

  it("prefers setup week record over edit day", () => {
    const route = resolvePrimaryComplianceFixRoute([
      { message: "20 min rest per 5h work", type: "warning", day: "Mon" },
      {
        message: "Need ≥2×24h continuous non-work in any 14-day period",
        type: "warning",
      },
    ]);
    expect(route?.kind).toBe("setup_week_record");
  });
});
