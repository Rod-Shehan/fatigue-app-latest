import { describe, expect, it } from "vitest";
import {
  DRIVER_NEAR_TERM_OPTS,
  MANAGER_NEAR_TERM_OPTS,
  detectNearTermSignals,
  driverChipLinesFromSignals,
  managerDetailForSignal,
} from "@/lib/near-term-exposure";
import { formatDriverShiftStillOpen } from "@/lib/product-copy";

const t0 = new Date("2026-06-01T08:00:00.000Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const h = (n: number) => n * 60 * 60 * 1000;
const m = (n: number) => n * 60 * 1000;

describe("detectNearTermSignals", () => {
  it("does not flag rest due on the EWD at the start of a 5h window (manager 24h still does)", () => {
    const events = [{ time: iso(t0), type: "work" }];
    const nowMs = t0 + h(1);
    const manager = detectNearTermSignals(events, nowMs, MANAGER_NEAR_TERM_OPTS);
    const driver = detectNearTermSignals(events, nowMs, DRIVER_NEAR_TERM_OPTS);
    expect(manager.some((s) => s.kind === "break_due")).toBe(true);
    expect(driver.some((s) => s.kind === "break_due" || s.kind === "break_overdue")).toBe(false);
  });

  it("flags rest due on the EWD inside the last 2h of the 5h window", () => {
    const events = [{ time: iso(t0), type: "work" }];
    const nowMs = t0 + h(3) + m(30);
    const driver = detectNearTermSignals(events, nowMs, DRIVER_NEAR_TERM_OPTS);
    expect(driver.some((s) => s.kind === "break_due")).toBe(true);
    const lines = driverChipLinesFromSignals(driver, nowMs);
    expect(lines[0]?.tone).toBe("caution");
    expect(lines[0]?.line).toMatch(/^Rest due by /);
    expect(lines[0]?.line).toMatch(/plan a stop$/);
  });

  it("flags rest overdue after 5h work with no qualifying rest", () => {
    const events = [{ time: iso(t0), type: "work" }];
    const nowMs = t0 + h(5) + m(10);
    const driver = detectNearTermSignals(events, nowMs, DRIVER_NEAR_TERM_OPTS);
    expect(driver.some((s) => s.kind === "break_overdue")).toBe(true);
    const lines = driverChipLinesFromSignals(driver, nowMs);
    expect(lines[0]?.tone).toBe("attention");
    expect(lines[0]?.line).toMatch(/Rest overdue/);
  });

  it("flags an open shift at 7h for the driver and 12h for the manager", () => {
    const events = [{ time: iso(t0), type: "work" }];
    const at8h = t0 + h(8);
    const driver = detectNearTermSignals(events, at8h, DRIVER_NEAR_TERM_OPTS);
    const manager = detectNearTermSignals(events, at8h, MANAGER_NEAR_TERM_OPTS);
    expect(driver.some((s) => s.kind === "no_stop_long")).toBe(true);
    expect(manager.some((s) => s.kind === "no_stop_long")).toBe(false);

    const at13h = t0 + h(13);
    expect(
      detectNearTermSignals(events, at13h, MANAGER_NEAR_TERM_OPTS).some((s) => s.kind === "no_stop_long")
    ).toBe(true);
    expect(driverChipLinesFromSignals(driver, at8h).some((l) => l.line === formatDriverShiftStillOpen())).toBe(
      true
    );
  });

  it("flags a rest window after End shift until 7h non-work", () => {
    const events = [
      { time: iso(t0), type: "work" },
      { time: iso(t0 + h(4)), type: "stop" },
    ];
    const nowMs = t0 + h(6);
    const signals = detectNearTermSignals(events, nowMs, DRIVER_NEAR_TERM_OPTS);
    const rest = signals.find((s) => s.kind === "insufficient_nonwork");
    expect(rest).toBeTruthy();
    expect(rest!.remainingRestMinutes).toBeGreaterThan(0);
    expect(managerDetailForSignal(rest!)).toMatch(/Recovery in progress/);
  });

  it("clears the rest window after 7h", () => {
    const events = [
      { time: iso(t0), type: "work" },
      { time: iso(t0 + h(4)), type: "stop" },
    ];
    const nowMs = t0 + h(4) + h(7) + m(1);
    const signals = detectNearTermSignals(events, nowMs, DRIVER_NEAR_TERM_OPTS);
    expect(signals.some((s) => s.kind === "insufficient_nonwork")).toBe(false);
  });

  it("keeps an open shift across midnight on the rolling list", () => {
    const start = new Date("2026-06-01T22:00:00.000Z").getTime();
    const events = [{ time: iso(start), type: "other_work" }];
    const nextMorning = start + h(8);
    const driver = detectNearTermSignals(events, nextMorning, DRIVER_NEAR_TERM_OPTS);
    expect(driver.some((s) => s.kind === "no_stop_long")).toBe(true);
  });
});
