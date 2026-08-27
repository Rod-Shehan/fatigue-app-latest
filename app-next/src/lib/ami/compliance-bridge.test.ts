import { describe, expect, it, afterEach } from "vitest";
import { getComplianceEngine } from "@/lib/jurisdiction/compliance-engine";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction/types";
import { runComplianceChecks, type ComplianceDayData } from "@/lib/compliance";
import { scoreTwoUp184E3b } from "@/lib/two-up-stationary";
import { getPerthMidnightUtcMs } from "@/lib/weeks";
import { isAmiComplianceEngineEnabled } from "./flag";
import { runWaComplianceChecks } from "./compliance-bridge";

const GPS = { lat: -31.95, lng: 115.86 };

const emptyWeek = (): ComplianceDayData[] =>
  Array.from({ length: 7 }, () => ({
    work_time: Array(1440).fill(false),
    breaks: Array(1440).fill(false),
    non_work: Array(1440).fill(false),
    events: [],
  }));

const addDaysYmd = (ymd: string, n: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const perthIso = (ymd: string, hour: number) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
};

/** Nightly 10h work / 14h End shift week (two-up 48h option when GPS is on the stop). */
function twoUpNightlyStopWeek(weekStarting: string, withGps: boolean): ComplianceDayData[] {
  const days = emptyWeek();
  for (let i = 0; i < 7; i++) {
    const ymd = addDaysYmd(weekStarting, i);
    const work = Array(1440).fill(false);
    const nw = Array(1440).fill(false);
    for (let m = 8 * 60; m < 18 * 60; m++) work[m] = true;
    for (let m = 0; m < 8 * 60; m++) nw[m] = true;
    for (let m = 18 * 60; m < 1440; m++) nw[m] = true;
    days[i] = {
      work_time: work,
      breaks: Array(1440).fill(false),
      non_work: nw,
      events: [
        { type: "work", time: perthIso(ymd, 8) },
        withGps
          ? { type: "stop", time: perthIso(ymd, 18), ...GPS }
          : { type: "stop", time: perthIso(ymd, 18) },
      ],
    };
  }
  return days;
}

describe("AMI Phase 3 flag + WA bridge", () => {
  const prev = process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
  const prevPublic = process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    else process.env.AMI_COMPLIANCE_ENGINE_ENABLED = prev;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;
    else process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED = prevPublic;
  });

  it("defaults to enabled", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;
    expect(isAmiComplianceEngineEnabled()).toBe(true);
  });

  it("flag off: bridge equals legacy runComplianceChecks", () => {
    process.env.AMI_COMPLIANCE_ENGINE_ENABLED = "false";
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;
    const days = emptyWeek();
    const a = runWaComplianceChecks(days, { driverType: "solo" });
    const b = runComplianceChecks(days, { driverType: "solo" });
    expect(a).toEqual(b);
  });

  it("default on: getComplianceEngine(WA) returns results without throwing", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;
    const engine = getComplianceEngine(DEFAULT_JURISDICTION_CODE);
    const results = engine.run(emptyWeek(), { driverType: "solo" });
    expect(Array.isArray(results)).toBe(true);
  });

  it("honours declared ≥24h rests for solo 14-day rule (AMI on)", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const days = emptyWeek();
    // First-week Sunday: work after only a few hours of blank time — not 2×24h yet.
    days[0] = {
      ...days[0],
      work_time: Array(1440).fill(false).map((_, i) => i >= 8 * 60 && i < 13 * 60),
      events: [
        { type: "work", time: "2026-07-19T00:00:00.000Z" }, // 08:00 Perth
        { type: "stop", time: "2026-07-19T05:00:00.000Z" }, // 13:00 Perth
      ],
    };

    const asOf = {
      weekStarting: "2026-07-19",
      currentDayIndex: 0,
      slotOffsetWithinToday: 15 * 60,
    } as const;

    const without = runWaComplianceChecks(days, {
      driverType: "solo",
      ...asOf,
    });
    expect(without.some((r) => r.message.includes("2×24h"))).toBe(true);

    const withDecls = runWaComplianceChecks(days, {
      driverType: "solo",
      ...asOf,
      declared24hRests: {
        last_24h_rest_1: "2026-07-10",
        last_24h_rest_1_start: "2026-07-09T16:00:00.000Z",
        last_24h_rest_1_end: "2026-07-11T16:00:00.000Z",
        last_24h_rest_2: "2026-07-17",
        last_24h_rest_2_start: "2026-07-16T16:00:00.000Z",
        last_24h_rest_2_end: "2026-07-18T16:00:00.000Z",
      },
    });
    expect(withDecls.some((r) => r.message.includes("2×24h"))).toBe(false);
  });

  it("counts blank days before first work as 14-day rest (paper-diary non-work)", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const days = emptyWeek();
    days[3] = {
      ...days[3],
      events: [{ type: "work", time: "2026-08-19T02:51:00.000Z" }], // 10:51 Perth
    };

    const results = runWaComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-08-16",
      currentDayIndex: 3,
      slotOffsetWithinToday: 10 * 60 + 52,
    });
    expect(results.some((r) => r.message.includes("2×24h"))).toBe(false);
  });

  it("does not flag 5h when the shift started this morning (00:00 of the sheet day, not the host's 00:00)", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const days = emptyWeek();
    days[3] = {
      ...days[3],
      events: [{ type: "work", time: "2026-08-19T02:51:00.000Z" }], // 10:51 Perth
    };

    const results = runWaComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-08-16",
      currentDayIndex: 3,
      slotOffsetWithinToday: 11 * 60 + 38, // 11:38 Perth
    });
    expect(results.some((r) => r.message.includes("20 min rest per 5h"))).toBe(false);
  });

  it("5h flag names the weekday and rest minutes, not AMI", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const days = emptyWeek();
    days[0] = {
      ...days[0],
      events: [
        { type: "work", time: "2026-08-16T00:00:00.000Z" }, // 08:00 Perth
        { type: "break", time: "2026-08-16T05:00:00.000Z" }, // 13:00 Perth
        { type: "work", time: "2026-08-16T05:19:00.000Z" },
        { type: "stop", time: "2026-08-16T06:19:00.000Z" },
      ],
    };

    const results = runWaComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-08-16",
      currentDayIndex: 0,
      slotOffsetWithinToday: 15 * 60,
    });
    const five = results.find((r) => r.message.includes("20 min rest per 5h work not met"));
    expect(five).toBeTruthy();
    expect(five?.day).toBe("Sun");
    expect(five?.scrollDayIndex).toBe(0);
    expect(five?.message).toContain("19 min");
    expect(five?.message.toLowerCase()).not.toContain("ami");
    expect(five?.message).not.toBe("More than 5h work without valid break");
  });

  it("solo 28-day alternative satisfies 184E(2)(b) on the live AMI path", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const addDays = (ymd: string, n: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const perthIso = (ymd: string, hour: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
    };
    const restDay = (): ComplianceDayData => ({
      work_time: Array(1440).fill(false),
      breaks: Array(1440).fill(false),
      non_work: Array(1440).fill(true),
      events: [],
    });
    const workDay = (ymd: string, workHours: number): ComplianceDayData => {
      const work = Array(1440).fill(false);
      const nw = Array(1440).fill(false);
      for (let i = 8 * 60; i < (8 + workHours) * 60; i++) work[i] = true;
      for (let i = 0; i < 8 * 60; i++) nw[i] = true;
      for (let i = (8 + workHours) * 60; i < 1440; i++) nw[i] = true;
      return {
        work_time: work,
        breaks: Array(1440).fill(false),
        non_work: nw,
        events: [
          { type: "work", time: perthIso(ymd, 8) },
          { type: "stop", time: perthIso(ymd, 8 + workHours) },
        ],
      };
    };

    const historyStart = addDays(weekStarting, -21);
    const historyDays = Array.from({ length: 21 }, (_, idx) => {
      const ymd = addDays(historyStart, idx);
      if (idx === 0 || idx === 6 || idx === 12) return restDay();
      return workDay(ymd, 10);
    });
    const days = emptyWeek();
    for (let i = 0; i < 6; i++) days[i] = workDay(addDays(weekStarting, i), 10);
    days[6] = restDay();

    const asOf = {
      weekStarting,
      historyDays,
      currentDayIndex: 6,
      slotOffsetWithinToday: 24 * 60,
    } as const;

    const results = runWaComplianceChecks(days, { driverType: "solo", ...asOf });
    expect(results.some((r) => r.message.includes("2×24h"))).toBe(false);
  });

  it("28-day alternative still fails on the live AMI path when 144h work is exceeded", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const addDays = (ymd: string, n: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const perthIso = (ymd: string, hour: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
    };
    const restDay = (): ComplianceDayData => ({
      work_time: Array(1440).fill(false),
      breaks: Array(1440).fill(false),
      non_work: Array(1440).fill(true),
      events: [],
    });
    const workDay = (ymd: string, workHours: number): ComplianceDayData => {
      const work = Array(1440).fill(false);
      const nw = Array(1440).fill(false);
      for (let i = 8 * 60; i < (8 + workHours) * 60; i++) work[i] = true;
      for (let i = 0; i < 8 * 60; i++) nw[i] = true;
      for (let i = (8 + workHours) * 60; i < 1440; i++) nw[i] = true;
      return {
        work_time: work,
        breaks: Array(1440).fill(false),
        non_work: nw,
        events: [
          { type: "work", time: perthIso(ymd, 8) },
          { type: "stop", time: perthIso(ymd, 8 + workHours) },
        ],
      };
    };

    const historyStart = addDays(weekStarting, -21);
    const historyDays = Array.from({ length: 21 }, (_, idx) => {
      const ymd = addDays(historyStart, idx);
      if (idx === 0 || idx === 6 || idx === 12) return restDay();
      return workDay(ymd, 12);
    });
    const days = emptyWeek();
    for (let i = 0; i < 6; i++) days[i] = workDay(addDays(weekStarting, i), 12);
    days[6] = restDay();

    const results = runWaComplianceChecks(days, {
      driverType: "solo",
      weekStarting,
      historyDays,
      currentDayIndex: 6,
      slotOffsetWithinToday: 24 * 60,
    });
    expect(results.some((r) => r.message.includes("28-day alternative"))).toBe(true);
  });

  it("two-up 48h option satisfies 184E(3)(b) on the live AMI path when 7-day structure fails", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const addDays = (ymd: string, n: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const perthIso = (ymd: string, hour: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
    };
    const days = emptyWeek();
    for (let i = 0; i < 7; i++) {
      const ymd = addDays(weekStarting, i);
      const work = Array(1440).fill(false);
      const nw = Array(1440).fill(false);
      for (let m = 8 * 60; m < 18 * 60; m++) work[m] = true;
      for (let m = 0; m < 8 * 60; m++) nw[m] = true;
      for (let m = 18 * 60; m < 1440; m++) nw[m] = true;
      days[i] = {
        work_time: work,
        breaks: Array(1440).fill(false),
        non_work: nw,
        events: [
          { type: "work", time: perthIso(ymd, 8) },
          { type: "stop", time: perthIso(ymd, 18), lat: -31.95, lng: 115.86 },
        ],
      };
    }

    const results = runWaComplianceChecks(days, {
      driverType: "two_up",
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    });
    expect(results.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      false
    );
  });

  it("two-up sleeper berth does not satisfy 184E(3)(b) on the live path (needs GPS Parked or End shift)", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const addDays = (ymd: string, n: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const perthIso = (ymd: string, hour: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
    };
    const days = emptyWeek();
    for (let i = 0; i < 7; i++) {
      const ymd = addDays(weekStarting, i);
      const work = Array(1440).fill(false);
      const nw = Array(1440).fill(false);
      for (let m = 8 * 60; m < 18 * 60; m++) work[m] = true;
      for (let m = 0; m < 8 * 60; m++) nw[m] = true;
      for (let m = 18 * 60; m < 1440; m++) nw[m] = true;
      days[i] = {
        work_time: work,
        breaks: Array(1440).fill(false),
        non_work: nw,
        events: [
          { type: "work", time: perthIso(ymd, 8) },
          { type: "sleeper_berth", time: perthIso(ymd, 18), lat: -31.95, lng: 115.86 },
        ],
      };
    }

    const results = runWaComplianceChecks(days, {
      driverType: "two_up",
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    });
    expect(results.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      true
    );
  });

  it("two-up GPS Parked meets 184E(3)(b) 48h option on the live path", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const addDays = (ymd: string, n: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const perthIso = (ymd: string, hour: number) => {
      const [y, m, d] = ymd.split("-").map(Number);
      return new Date(Date.UTC(y, m - 1, d, hour - 8, 0, 0)).toISOString();
    };
    const ymd = addDays(weekStarting, 6);
    const days = emptyWeek();
    const work = Array(1440).fill(false);
    const nw = Array(1440).fill(false);
    for (let m = 8 * 60; m < 10 * 60; m++) work[m] = true;
    for (let m = 10 * 60; m < 18 * 60; m++) nw[m] = true;
    days[6] = {
      work_time: work,
      breaks: Array(1440).fill(false),
      non_work: nw,
      events: [
        { type: "work", time: perthIso(ymd, 8) },
        { type: "stationary_rest", time: perthIso(ymd, 10), lat: -31.95, lng: 115.86 },
      ],
    };

    const results = runWaComplianceChecks(days, {
      driverType: "two_up",
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    });
    expect(results.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      false
    );
  });

  it("two-up End shift without GPS does not satisfy 184E(3)(b) on the live path", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const results = runWaComplianceChecks(twoUpNightlyStopWeek(weekStarting, false), {
      driverType: "two_up",
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    });
    expect(results.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      true
    );
    expect(results.some((r) => r.message.includes("GPS-proven Parked or End shift"))).toBe(true);
  });

  it("two-up 7-day GPS option passes 184E(3)(b) when last 48h has no 7h GPS block", () => {
    delete process.env.AMI_COMPLIANCE_ENGINE_ENABLED;
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const sun = addDaysYmd(weekStarting, 0);
    const tue = addDaysYmd(weekStarting, 2);
    const fri = addDaysYmd(weekStarting, 5);
    const sat = addDaysYmd(weekStarting, 6);
    const days = emptyWeek();
    days[0] = {
      ...days[0],
      events: [{ type: "stop", time: perthIso(sun, 0), ...GPS }],
    };
    days[2] = {
      ...days[2],
      events: [{ type: "work", time: perthIso(tue, 0) }],
    };
    days[5] = {
      ...days[5],
      events: [{ type: "sleeper_berth", time: perthIso(fri, 18) }],
    };

    const asOfMs = getPerthMidnightUtcMs(sat) + 18 * 60 * 60_000;
    const recordStartMs = getPerthMidnightUtcMs(weekStarting);
    const scored = scoreTwoUp184E3b(
      [
        { type: "stop", time: perthIso(sun, 0), ...GPS },
        { type: "work", time: perthIso(tue, 0) },
        { type: "sleeper_berth", time: perthIso(fri, 18) },
      ],
      asOfMs,
      recordStartMs
    );
    expect(scored.t48.hasQualBlock).toBe(false);
    expect(scored.t7.structureOk).toBe(true);
    expect(scored.ok).toBe(true);

    const results = runWaComplianceChecks(days, {
      driverType: "two_up",
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    });
    expect(results.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      false
    );
  });

  it("kill-switch: GPS End shift meets 184E(3)(b); sleeper berth does not", () => {
    process.env.AMI_COMPLIANCE_ENGINE_ENABLED = "false";
    delete process.env.NEXT_PUBLIC_AMI_COMPLIANCE_ENGINE_ENABLED;

    const weekStarting = "2026-07-19";
    const asOf = {
      driverType: "two_up" as const,
      weekStarting,
      currentDayIndex: 6,
      slotOffsetWithinToday: 18 * 60,
    };
    const gpsStop = runWaComplianceChecks(twoUpNightlyStopWeek(weekStarting, true), asOf);
    expect(gpsStop.some((r) => r.message.includes("48h option") || r.message.includes("7-day option"))).toBe(
      false
    );

    const sleeperDays = twoUpNightlyStopWeek(weekStarting, true);
    for (const day of sleeperDays) {
      day.events = (day.events ?? []).map((e) =>
        e.type === "stop" ? { ...e, type: "sleeper_berth" } : e
      );
    }
    const sleeper = runWaComplianceChecks(sleeperDays, asOf);
    expect(sleeper.some((r) => r.message.includes("GPS-proven Parked or End shift"))).toBe(true);
  });
});
