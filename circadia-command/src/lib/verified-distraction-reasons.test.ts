import { describe, expect, it } from "vitest";
import {
  cameraAlertEventKindFromMetric,
  formatVerifiedDistractionReasonsForNote,
  normalizeVerifiedDistractionReasons,
  requireVerifiedDistractionReasons,
} from "@/lib/verified-distraction-reasons";

describe("verified-distraction-reasons", () => {
  it("requires at least one reason", () => {
    expect(() => requireVerifiedDistractionReasons([])).toThrow("VERIFIED_DISTRACTION_REASONS_REQUIRED");
    expect(requireVerifiedDistractionReasons(["paperwork"])).toEqual(["paperwork"]);
  });

  it("normalises and dedupes reason ids", () => {
    expect(normalizeVerifiedDistractionReasons(["eating", "eating", "mobile_phone_use"])).toEqual([
      "eating",
      "mobile_phone_use",
    ]);
  });

  it("formats note with trigger labels", () => {
    expect(formatVerifiedDistractionReasonsForNote(["eating", "paperwork"])).toBe(
      "Verified distraction — Trigger: Eating, Paperwork"
    );
  });

  it("classifies fatigue metric type for triage actions", () => {
    expect(cameraAlertEventKindFromMetric("DISTRACTION")).toBe("distraction");
    expect(cameraAlertEventKindFromMetric("FATIGUE")).toBe("fatigue");
    expect(cameraAlertEventKindFromMetric("")).toBe("unknown");
  });
});
