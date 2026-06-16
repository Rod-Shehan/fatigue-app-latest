import { describe, expect, it } from "vitest";
import {
  resolveActionChrome,
  resolveBreakDueTone,
  resolveComplianceTone,
  resolvePieWedgeTier,
} from "@/lib/driver-compliance-chrome";
import { resolveCompliancePieState } from "@/lib/compliance-pie-state";

describe("resolveComplianceTone", () => {
  it("prioritises violations over shift-open ok", () => {
    expect(
      resolveComplianceTone({ hasViolations: true, shiftSegmentOpen: true })
    ).toBe("violation");
  });

  it("returns ok when on shift and sheet is clear", () => {
    expect(resolveComplianceTone({ shiftSegmentOpen: true })).toBe("ok");
  });

  it("returns pending when on break and 2×10 rest incomplete", () => {
    expect(
      resolveComplianceTone({ shiftSegmentOpen: true, breakRestIncomplete: true })
    ).toBe("pending");
  });
});

describe("resolveBreakDueTone", () => {
  it("maps work-window minutes to amber and red", () => {
    expect(resolveBreakDueTone(46, "work")).toBe(null);
    expect(resolveBreakDueTone(45, "work")).toBe("amber");
    expect(resolveBreakDueTone(15, "work")).toBe("red");
    expect(resolveBreakDueTone(10, "break")).toBe(null);
  });
});

describe("resolvePieWedgeTier", () => {
  it("matches chrome priority", () => {
    expect(resolvePieWedgeTier("violation", null)).toBe("warning");
    expect(resolvePieWedgeTier("ok", "red")).toBe("breach");
    expect(resolvePieWedgeTier("ok", "amber")).toBe("warning");
    expect(resolvePieWedgeTier("ok", null)).toBe("safe");
    expect(resolvePieWedgeTier("default", null)).toBe("neutral");
  });
});

describe("resolveActionChrome", () => {
  it("uses emerald idle hero when at top", () => {
    const chrome = resolveActionChrome({ complianceTone: "default", breakDueTone: null, isIdleAtTop: true });
    expect(chrome.surfaceClass).toContain("bg-emerald-500");
  });
});

describe("resolveCompliancePieState", () => {
  it("builds wedge and hub chrome from the same rules", () => {
    const state = resolveCompliancePieState({
      workMinutesUsed: 286,
      totalWindowMinutes: 300,
      currentSegment: "work",
      shiftSegmentOpen: true,
    });
    expect(state.breakDueTone).toBe("red");
    expect(state.wedgeTier).toBe("breach");
    expect(state.chrome.surfaceClass).toContain("bg-red-600");
    expect(state.wedgeGradient).toContain("conic-gradient");
  });

  it("uses pending chrome and split break ring on break", () => {
    const state = resolveCompliancePieState({
      workMinutesUsed: 120,
      totalWindowMinutes: 300,
      currentSegment: "break",
      shiftSegmentOpen: true,
      breakRing: {
        leftPct: 50,
        rightPct: 0,
        complete: false,
        priorSlot1: false,
        priorSlot2: false,
      },
    });
    expect(state.complianceTone).toBe("pending");
    expect(state.wedgeGradient).toContain("#f59e0b");
    expect(state.chrome.surfaceClass).toContain("amber-500");
  });
});
