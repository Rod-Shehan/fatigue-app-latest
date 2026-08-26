import { describe, expect, it } from "vitest";
import { getDriverHomeShiftStatus } from "./driver-home-status";
import type { DayData } from "@/lib/api";

const week = "2026-05-24";
const today = "2026-05-28";

describe("getDriverHomeShiftStatus", () => {
  it("idle when no events", () => {
    const days = Array(7).fill({ events: [] }) as DayData[];
    const s = getDriverHomeShiftStatus(days, 4, week, today);
    expect(s.activity).toBe("idle");
    expect(s.headline).toMatch(/Ready/i);
  });

  it("work with elapsed", () => {
    const t = new Date(`${today}T08:00:00`).toISOString();
    const days = [{ events: [{ time: t, type: "work" }] }] as DayData[];
    const now = new Date(`${today}T09:30:00`).getTime();
    const s = getDriverHomeShiftStatus(days, 4, week, today, now);
    expect(s.activity).toBe("work");
    expect(s.headline).toContain("On work");
  });

  it("other_work is a live on-duty state, not idle", () => {
    const t = new Date(`${today}T08:00:00`).toISOString();
    const days = [{ events: [{ time: t, type: "other_work" }] }] as DayData[];
    const now = new Date(`${today}T08:20:00`).getTime();
    const s = getDriverHomeShiftStatus(days, 4, week, today, now);
    expect(s.activity).toBe("other_work");
    expect(s.headline).toContain("On other work");
    expect(s.detail).toMatch(/Start driving/);
    expect(s.detail).toMatch(/Start Rest/);
    expect(s.detail).toMatch(/Load check/);
    expect(s.detail).not.toMatch(/Not a load/);
  });
});
