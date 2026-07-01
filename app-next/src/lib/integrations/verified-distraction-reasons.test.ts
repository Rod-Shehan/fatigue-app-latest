import { describe, expect, it } from "vitest";
import {
  formatVerifiedDistractionReasonsForNote,
  normalizeVerifiedDistractionReasons,
  requireVerifiedDistractionReasons,
} from "@/lib/integrations/verified-distraction-reasons";

describe("verified-distraction-reasons", () => {
  it("requires at least one reason", () => {
    expect(() => requireVerifiedDistractionReasons([])).toThrow("VERIFIED_DISTRACTION_REASONS_REQUIRED");
    expect(requireVerifiedDistractionReasons(["mobile_phone_use"])).toEqual(["mobile_phone_use"]);
  });

  it("normalises and dedupes reason ids", () => {
    expect(
      normalizeVerifiedDistractionReasons(["eating", "invalid", "eating", "paperwork"])
    ).toEqual(["eating", "paperwork"]);
  });

  it("formats note with trigger labels", () => {
    expect(formatVerifiedDistractionReasonsForNote(["mobile_phone_use"], "brief call")).toBe(
      "Verified distraction — Trigger: Mobile phone use — brief call"
    );
  });
});
