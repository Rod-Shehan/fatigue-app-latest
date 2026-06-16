import { describe, expect, it } from "vitest";
import {
  buildComplianceClockConicGradient,
  buildBreakSplitPieGradient,
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

describe("buildBreakSplitPieGradient", () => {
  it("is full emerald when 2×10 rest is complete", () => {
    const g = buildBreakSplitPieGradient({
      leftPct: 100,
      rightPct: 100,
      complete: true,
      priorSlot1: true,
      priorSlot2: true,
    });
    expect(g).toContain("#10b981");
    expect(g).not.toContain("#f59e0b");
  });

  it("fills first 10 min as 90° amber arc from 12 o'clock", () => {
    const g = buildBreakSplitPieGradient({
      leftPct: 50,
      rightPct: 0,
      complete: false,
      priorSlot1: false,
      priorSlot2: false,
    });
    expect(g).toContain("#f59e0b");
    expect(g).toContain("45deg");
    expect(g).toContain("90deg");
    expect(g).toContain("180deg");
    expect(g).toContain("#475569");
  });

  it("shows green first slot and amber second while 15 min into break", () => {
    const g = buildBreakSplitPieGradient({
      leftPct: 100,
      rightPct: 50,
      complete: false,
      priorSlot1: false,
      priorSlot2: false,
    });
    expect(g).toContain("#10b981");
    expect(g).toContain("#f59e0b");
    expect(g).toContain("135deg");
  });
});
