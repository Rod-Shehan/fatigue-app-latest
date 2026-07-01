import { describe, expect, it } from "vitest";
import {
  confidenceScoreFromVendorAlarm,
  deterministicDriverUuid,
  fatigueMetricTypeFromVendorAlarm,
  resolveVehicleRegistrationForQueue,
  TRIAGE_QUEUE_PLACEHOLDER_REGO,
} from "@/lib/integrations/command-lifecycle-bridge";

describe("command-lifecycle-bridge helpers", () => {
  it("maps vendor alarms to display metric types", () => {
    expect(fatigueMetricTypeFromVendorAlarm("VT3600AI_ALARM_DSM_Fatigue")).toBe("FATIGUE");
    expect(fatigueMetricTypeFromVendorAlarm("VT3600AI_ALARM_DSM_Distracted")).toBe("DISTRACTION");
  });

  it("assigns confidence from vendor classification", () => {
    expect(confidenceScoreFromVendorAlarm("VT3600AI_ALARM_DSM_Fatigue")).toBe(0.9);
    expect(confidenceScoreFromVendorAlarm("VT3600AI_ALARM_ADAS_LaneDeparture")).toBe(0.75);
  });

  it("derives stable driver UUIDs per tenant + driver + rego", () => {
    const tenant = "11111111-1111-4111-8111-111111111111";
    const a = deterministicDriverUuid(tenant, "Jane Doe", "ABC123");
    const b = deterministicDriverUuid(tenant, "Jane Doe", "ABC123");
    const c = deterministicDriverUuid(tenant, "John Doe", "ABC123");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("uses placeholder rego when VRN is missing so triage queue promotion is not blocked", () => {
    expect(resolveVehicleRegistrationForQueue(null)).toBe(TRIAGE_QUEUE_PLACEHOLDER_REGO);
    expect(resolveVehicleRegistrationForQueue("  ")).toBe(TRIAGE_QUEUE_PLACEHOLDER_REGO);
    expect(resolveVehicleRegistrationForQueue("1abc999")).toBe("1ABC999");
  });
});
