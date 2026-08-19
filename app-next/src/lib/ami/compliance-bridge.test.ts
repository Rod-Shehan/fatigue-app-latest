import { describe, expect, it, afterEach } from "vitest";
import { getComplianceEngine } from "@/lib/jurisdiction/compliance-engine";
import { DEFAULT_JURISDICTION_CODE } from "@/lib/jurisdiction/types";
import { runComplianceChecks, type ComplianceDayData } from "@/lib/compliance";
import { isAmiComplianceEngineEnabled } from "./flag";
import { runWaComplianceChecks } from "./compliance-bridge";

const emptyWeek = (): ComplianceDayData[] =>
  Array.from({ length: 7 }, () => ({
    work_time: Array(1440).fill(false),
    breaks: Array(1440).fill(false),
    non_work: Array(1440).fill(false),
    events: [],
  }));

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
});
