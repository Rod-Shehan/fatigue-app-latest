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
      requireFalsePositiveReasonsForDismiss("VERIFIED_FALSE_POSITIVE", ["undetermined"])
    ).toEqual(["undetermined"]);
    expect(requireFalsePositiveReasonsForDismiss("VERIFIED_TRUE_FATIGUE", [])).toEqual([]);
  });

  it("formats dismiss note for lifecycle audit", () => {
    expect(
      formatFalsePositiveReasonsForNote(["driver_looking_left", "driver_looking_down"], null)
    ).toBe("Trigger: Driver looking left, Driver looking down");
  });
});
