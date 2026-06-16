import { describe, expect, it } from "vitest";
import {
  buildComplianceClockConicGradient,
  formatComplianceCountdown,
  getComplianceClockLabel,
  getComplianceClockTier,
  getRemainingWindowMinutes,
  getUsedWedgePercent,
} from "@/lib/compliance-clock";

describe("getComplianceClockTier", () => {
  it("tiers by remaining minutes", () => {
    expect(getComplianceClockTier(46)).toBe("safe");
    expect(getComplianceClockTier(45)).toBe("warning");
    expect(getComplianceClockTier(16)).toBe("warning");
    expect(getComplianceClockTier(15)).toBe("breach");
    expect(getComplianceClockTier(0)).toBe("breach");
  });
});

describe("getRemainingWindowMinutes", () => {
  it("clamps used time to the window", () => {
    expect(getRemainingWindowMinutes(120, 300)).toBe(180);
    expect(getRemainingWindowMinutes(400, 300)).toBe(0);
  });
});

describe("getUsedWedgePercent", () => {
  it("maps used minutes to wedge percent", () => {
    expect(getUsedWedgePercent(150, 300)).toBe(50);
    expect(getUsedWedgePercent(0, 300)).toBe(0);
  });
});

describe("formatComplianceCountdown", () => {
  it("formats hours and minutes for cab display", () => {
    expect(formatComplianceCountdown(195)).toBe("3h 15m");
    expect(formatComplianceCountdown(60)).toBe("1h");
    expect(formatComplianceCountdown(14.2)).toBe("15m");
  });
});

describe("getComplianceClockLabel", () => {
  it("returns uppercase safety labels", () => {
    expect(getComplianceClockLabel("safe", 120)).toBe("WORK WINDOW LEFT");
    expect(getComplianceClockLabel("warning", 30)).toBe("BREAK DUE SOON");
    expect(getComplianceClockLabel("breach", 0)).toBe("BREAK REQUIRED NOW");
  });
});

describe("buildComplianceClockConicGradient", () => {
  it("returns a conic gradient string", () => {
    const gradient = buildComplianceClockConicGradient(75, 300, "safe");
    expect(gradient).toMatch(/^conic-gradient\(/);
    expect(gradient).toContain("#10b981");
  });
});
