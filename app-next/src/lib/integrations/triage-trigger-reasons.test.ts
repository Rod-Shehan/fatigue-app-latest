import { describe, expect, it } from "vitest";
import {
  normalizeTriageTriggerReasons,
  requireTriageTriggerReasons,
  TRIAGE_TRIGGER_REASONS,
} from "@/lib/integrations/triage-trigger-reasons";
import { normalizeFalsePositiveReasons } from "@/lib/integrations/false-positive-reasons";
import { normalizeVerifiedDistractionReasons } from "@/lib/integrations/verified-distraction-reasons";

describe("triage-trigger-reasons", () => {
  it("includes fatigue and distraction categories in one catalog", () => {
    const ids = TRIAGE_TRIGGER_REASONS.map((r) => r.id);
    expect(ids).toContain("driver_looking_left");
    expect(ids).toContain("mobile_phone_use");
    expect(ids).toContain("eating");
    expect(ids).toContain("paperwork");
  });

  it("accepts any catalog id in dismiss and distraction normalizers", () => {
    const raw = ["mobile_phone_use", "driver_looking_down"];
    expect(normalizeTriageTriggerReasons(raw)).toEqual(raw);
    expect(normalizeFalsePositiveReasons(raw)).toEqual(raw);
    expect(normalizeVerifiedDistractionReasons(raw)).toEqual(raw);
  });

  it("requires at least one reason", () => {
    expect(() => requireTriageTriggerReasons([])).toThrow("TRIAGE_TRIGGER_REASONS_REQUIRED");
    expect(requireTriageTriggerReasons(["undetermined"])).toEqual(["undetermined"]);
  });
});
