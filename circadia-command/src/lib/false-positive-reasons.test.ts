import { describe, expect, it } from "vitest";
import {
  formatFalsePositiveReasonsForNote,
  requireFalsePositiveReasonsForDismiss,
} from "@/lib/false-positive-reasons";

describe("false-positive-reasons", () => {
  it("requires reasons for VERIFIED_FALSE_POSITIVE", () => {
    expect(() => requireFalsePositiveReasonsForDismiss("VERIFIED_FALSE_POSITIVE", [])).toThrow(
      "FALSE_POSITIVE_REASONS_REQUIRED"
    );
    expect(
      requireFalsePositiveReasonsForDismiss("VERIFIED_FALSE_POSITIVE", ["unknown_cause"])
    ).toEqual(["unknown_cause"]);
    expect(requireFalsePositiveReasonsForDismiss("VERIFIED_TRUE_FATIGUE", [])).toEqual([]);
  });

  it("formats dismiss note for lifecycle audit", () => {
    expect(
      formatFalsePositiveReasonsForNote(
        ["driver_looking_left_mirror", "driver_looking_down_at_dash"],
        null
      )
    ).toBe("Trigger: Driver looking in left mirror, Driver looking down at dash");
  });
});
