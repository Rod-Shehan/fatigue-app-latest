import { describe, expect, it } from "vitest";
import { normalizeFalsePositiveReasons } from "@/lib/false-positive-reasons";
import { normalizeVerifiedDistractionReasons } from "@/lib/verified-distraction-reasons";
import { TRIAGE_TRIGGER_REASONS } from "@/lib/triage-trigger-reasons";

describe("triage-trigger-reasons", () => {
  it("shares one catalog across dismiss and verified distraction", () => {
    const ids = TRIAGE_TRIGGER_REASONS.map((r) => r.id);
    expect(ids).toContain("hand_over_face");
    expect(ids).toContain("paperwork");
    const raw = ["eating", "driver_looking_up"];
    expect(normalizeFalsePositiveReasons(raw)).toEqual(raw);
    expect(normalizeVerifiedDistractionReasons(raw)).toEqual(raw);
  });
});
