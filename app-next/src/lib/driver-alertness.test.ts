import { describe, expect, it } from "vitest";
import {
  DRIVER_ALERTNESS_LEVELS,
  driverAlertnessMustStop,
  driverAlertnessNeedsBreakWarning,
  driverAlertnessRiskFactor,
  formatDriverAlertnessCompact,
  getDriverAlertnessOption,
  isDriverAlertnessLevel,
} from "./driver-alertness";

describe("driver-alertness", () => {
  it("has five levels with emoji and copy", () => {
    expect(DRIVER_ALERTNESS_LEVELS).toHaveLength(5);
    expect(DRIVER_ALERTNESS_LEVELS[0]?.emoji).toBe("🟢");
    expect(DRIVER_ALERTNESS_LEVELS[4]?.emoji).toBe("🛑");
  });

  it("validates level numbers", () => {
    expect(isDriverAlertnessLevel(3)).toBe(true);
    expect(isDriverAlertnessLevel(6)).toBe(false);
    expect(isDriverAlertnessLevel("3")).toBe(false);
  });

  it("formats compact label", () => {
    expect(formatDriverAlertnessCompact(1)).toContain("100% Awake");
    expect(formatDriverAlertnessCompact(null)).toBe("—");
  });

  it("maps risk factor upward with severity", () => {
    expect(driverAlertnessRiskFactor(1)).toBeLessThan(driverAlertnessRiskFactor(3));
    expect(driverAlertnessRiskFactor(5)).toBe(1);
  });

  it("flags high-risk levels", () => {
    expect(driverAlertnessNeedsBreakWarning(4)).toBe(true);
    expect(driverAlertnessMustStop(5)).toBe(true);
    expect(getDriverAlertnessOption(2)?.tone).toBe("yellow");
  });
});
