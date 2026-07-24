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
    // Short work week with no logged 24h non-work blocks on the event tape.
    days[0] = {
      ...days[0],
      work_time: Array(1440).fill(false).map((_, i) => i >= 600 && i < 900),
      events: [
        { type: "work", time: "2026-07-20T10:00:00.000Z" },
        { type: "stop", time: "2026-07-20T15:00:00.000Z" },
      ],
    };

    const without = runWaComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-07-19",
    });
    expect(without.some((r) => r.message.includes("2×24h"))).toBe(true);

    const withDecls = runWaComplianceChecks(days, {
      driverType: "solo",
      weekStarting: "2026-07-19",
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
});
