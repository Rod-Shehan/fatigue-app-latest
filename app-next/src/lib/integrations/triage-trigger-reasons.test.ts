import { describe, expect, it } from "vitest";
import {
  assertTriageTriggerFreeNoteWhenRequired,
  normalizeTriageTriggerReasons,
  requireTriageTriggerReasons,
  TRIAGE_TRIGGER_REASONS,
} from "@/lib/integrations/triage-trigger-reasons";
import { normalizeFalsePositiveReasons } from "@/lib/integrations/false-positive-reasons";
import { normalizeVerifiedDistractionReasons } from "@/lib/integrations/verified-distraction-reasons";

describe("triage-trigger-reasons", () => {
  it("includes the expanded false-positive / distraction catalog", () => {
    const ids = TRIAGE_TRIGGER_REASONS.map((r) => r.id);
    expect(ids).toContain("driver_looking_left_mirror");
    expect(ids).toContain("mobile_phone_use");
    expect(ids).toContain("paperwork_completing");
    expect(ids).toContain("unknown_cause");
    expect(ids).toContain("other");
    expect(ids).toHaveLength(16);
  });

  it("accepts any catalog id in dismiss and distraction normalizers", () => {
    const raw = ["mobile_phone_use", "driver_looking_down_at_dash"];
    expect(normalizeTriageTriggerReasons(raw)).toEqual(raw);
    expect(normalizeFalsePositiveReasons(raw)).toEqual(raw);
    expect(normalizeVerifiedDistractionReasons(raw)).toEqual(raw);
  });

  it("requires at least one reason", () => {
    expect(() => requireTriageTriggerReasons([])).toThrow("TRIAGE_TRIGGER_REASONS_REQUIRED");
    expect(requireTriageTriggerReasons(["unknown_cause"])).toEqual(["unknown_cause"]);
  });

  it("requires a free-text note when Other is selected", () => {
    expect(() => assertTriageTriggerFreeNoteWhenRequired(["other"], "")).toThrow(
      "TRIAGE_TRIGGER_FREE_NOTE_REQUIRED"
    );
    expect(() => assertTriageTriggerFreeNoteWhenRequired(["other"], "  ")).toThrow(
      "TRIAGE_TRIGGER_FREE_NOTE_REQUIRED"
    );
    expect(() =>
      assertTriageTriggerFreeNoteWhenRequired(["other"], "mirror glare from low sun")
    ).not.toThrow();
    expect(() => assertTriageTriggerFreeNoteWhenRequired(["eating"], "")).not.toThrow();
  });
});
