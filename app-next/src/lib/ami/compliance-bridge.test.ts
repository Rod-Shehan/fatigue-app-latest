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
});
