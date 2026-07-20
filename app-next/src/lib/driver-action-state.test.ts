import { describe, expect, it } from "vitest";
import {
  getActionRingTintClass,
  resolveActionChrome,
  resolveBreakDueTone,
  resolveComplianceTone,
} from "@/lib/driver-compliance-chrome";
import { resolveDriverActionState } from "@/lib/driver-action-state";

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

describe("resolveActionChrome", () => {
  it("uses emerald idle hero when at top", () => {
    const chrome = resolveActionChrome({
      complianceTone: "default",
      breakDueTone: null,
      isIdleAtTop: true,
    });
    expect(chrome.surfaceClass).toContain("bg-emerald-500");
  });
});

describe("getActionRingTintClass", () => {
  it("tracks operational chrome tones", () => {
    expect(
      getActionRingTintClass({ complianceTone: "ok", breakDueTone: null })
    ).toContain("emerald");
    expect(
      getActionRingTintClass({
        complianceTone: "pending",
        breakDueTone: null,
        breakRestBankedMinutes: 4,
      })
    ).toContain("amber");
    expect(
      getActionRingTintClass({
        complianceTone: "pending",
        breakDueTone: null,
        breakRestBankedMinutes: 12,
      })
    ).toContain("lime");
    expect(
      getActionRingTintClass({ complianceTone: "ok", breakDueTone: "red" })
    ).toContain("red");
    expect(
      getActionRingTintClass({ complianceTone: "default", breakDueTone: null, idleRestBlocked: true })
    ).toContain("red");
  });
});

describe("resolveDriverActionState", () => {
  it("uses red chrome when work window is nearly exhausted", () => {
    const state = resolveDriverActionState({
      workMinutesUsed: 286,
      totalWindowMinutes: 300,
      currentSegment: "work",
      shiftSegmentOpen: true,
    });
    expect(state.breakDueTone).toBe("red");
    expect(state.chrome.surfaceClass).toContain("bg-red-600");
    expect(state.statusLabel).toBe("BREAK REQUIRED NOW");
  });

  it("uses strong amber pending chrome until 10 min rest is banked", () => {
    const state = resolveDriverActionState({
      workMinutesUsed: 120,
      totalWindowMinutes: 300,
      currentSegment: "break",
      shiftSegmentOpen: true,
      breakRestIncomplete: true,
      breakRestBankedMinutes: 6,
    });
    expect(state.operationalTone).toBe("pending");
    expect(state.chrome.surfaceClass).toContain("bg-amber-500");
    expect(state.chrome.surfaceClass).not.toContain("gradient");
  });

  it("uses lime/emerald pending chrome from 10 min rest toward 20", () => {
    const state = resolveDriverActionState({
      workMinutesUsed: 120,
      totalWindowMinutes: 300,
      currentSegment: "break",
      shiftSegmentOpen: true,
      breakRestIncomplete: true,
      breakRestBankedMinutes: 14,
    });
    expect(state.operationalTone).toBe("pending");
    expect(state.chrome.surfaceClass).toContain("from-lime-500");
    expect(state.chrome.surfaceClass).toContain("to-emerald-500");
  });

  it("stays emerald on work when 5h window is safe", () => {
    const state = resolveDriverActionState({
      workMinutesUsed: 1,
      totalWindowMinutes: 300,
      currentSegment: "work",
      shiftSegmentOpen: true,
    });
    expect(state.breakDueTone).toBe(null);
    expect(state.chrome.surfaceClass).toContain("bg-emerald-500");
    expect(state.statusLabel).toBe("WORK WINDOW LEFT");
  });
});
