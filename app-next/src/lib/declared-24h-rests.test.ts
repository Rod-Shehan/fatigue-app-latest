import { describe, expect, it } from "vitest";
import { MINUTES_PER_DAY } from "@/lib/coverage/derive-minute-coverage";
import {
  getDeclared24hRestRequirement,
  option14Satisfied,
  collectDeclared24hRests,
  countEffective24hPeriods,
} from "@/lib/declared-24h-rests";
import { runComplianceChecks, type ComplianceDayData } from "@/lib/compliance";

function emptyDay(nonWorkAll = false): ComplianceDayData {
  return {
    work_time: Array(MINUTES_PER_DAY).fill(false),
    breaks: Array(MINUTES_PER_DAY).fill(false),
    non_work: Array(MINUTES_PER_DAY).fill(nonWorkAll),
  };
}

function dayWorkOnly(hours: number): ComplianceDayData {
  const work = Array(MINUTES_PER_DAY).fill(false);
  for (let m = 0; m < hours * 60 && m < MINUTES_PER_DAY; m++) work[m] = true;
  const non_work = work.map((w) => !w);
  return { work_time: work, breaks: Array(MINUTES_PER_DAY).fill(false), non_work };
}

describe("declared-24h-rests", () => {
  it("collects unique YYYY-MM-DD values", () => {
    expect(
      collectDeclared24hRests({
        last_24h_rest_1: "2026-07-10",
        last_24h_rest_2: "2026-07-10",
        last_24h_rest_3: "2026-07-12",
      })
    ).toEqual(["2026-07-10", "2026-07-12"]);
  });

  it("cold start: two declarations satisfy option14 with short timeline", () => {
    const nonWork = Array(3 * MINUTES_PER_DAY).fill(false);
    expect(option14Satisfied(nonWork, "2026-07-17", [])).toBe(false);
    expect(option14Satisfied(nonWork, "2026-07-17", ["2026-07-10", "2026-07-12"])).toBe(true);
  });

  it("UI requires 2 fields when short history lacks rests", () => {
    const nonWork = Array(7 * MINUTES_PER_DAY).fill(false);
    const work = Array(7 * MINUTES_PER_DAY).fill(false);
    const req = getDeclared24hRestRequirement({
      driverType: "solo",
      nonWork,
      work,
      timelineStartYmd: "2026-07-13",
      declared: [],
    });
    expect(req.fieldCount).toBe(2);
  });

  it("UI hides when two declarations present on short history", () => {
    const nonWork = Array(7 * MINUTES_PER_DAY).fill(false);
    const work = Array(7 * MINUTES_PER_DAY).fill(false);
    const req = getDeclared24hRestRequirement({
      driverType: "solo",
      nonWork,
      work,
      timelineStartYmd: "2026-07-13",
      declared: ["2026-07-10", "2026-07-11"],
    });
    expect(req.fieldCount).toBe(0);
  });

  it("never asks for 4 fields when timeline under 28 days", () => {
    const nonWork = Array(21 * MINUTES_PER_DAY).fill(false);
    const work = nonWork.map(() => false);
    for (let i = 0; i < work.length; i++) {
      if (i % MINUTES_PER_DAY < 10 * 60) work[i] = true;
    }
    const req = getDeclared24hRestRequirement({
      driverType: "solo",
      nonWork: work.map((w) => !w),
      work,
      timelineStartYmd: "2026-06-22",
      declared: [],
    });
    expect(req.fieldCount).toBe(2);
  });

  it("countEffective adds declared dates outside the grid", () => {
    const nonWork = Array(MINUTES_PER_DAY).fill(true);
    expect(countEffective24hPeriods(nonWork, "2026-07-20", ["2026-07-10", "2026-07-11"])).toBe(3);
  });
});

describe("compliance + declared 24h rests", () => {
  it("short week with work: two declared rests clears 2×24h violation", () => {
    const days = Array.from({ length: 7 }, () => emptyDay(false));
    days[1] = dayWorkOnly(4);
    const without = runComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-07-13",
    });
    expect(without.some((r) => r.message.includes("2×24h"))).toBe(true);

    const withDecls = runComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-07-13",
      declared24hRests: {
        last_24h_rest_1: "2026-07-10",
        last_24h_rest_2: "2026-07-11",
      },
    });
    expect(withDecls.some((r) => r.message.includes("2×24h"))).toBe(false);
  });
});
