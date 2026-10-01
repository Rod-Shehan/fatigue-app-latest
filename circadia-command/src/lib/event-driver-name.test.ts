import { describe, expect, it } from "vitest";
import { firstNonEmptyName, normalizeDriverName, pickResolvedDriverName } from "@/lib/event-driver-name";

describe("event-driver-name", () => {
  it("picks the first provided name and ignores blanks", () => {
    expect(firstNonEmptyName("  ", null, "Satnam")).toBe("Satnam");
    expect(
      pickResolvedDriverName({
        ingestName: "",
        payloadName: "  ",
        attributionName: "Jaydin",
        identityName: "Satnam",
      })
    ).toBe("Jaydin");
    expect(pickResolvedDriverName({ ingestName: "Pat" })).toBe("Pat");
    expect(pickResolvedDriverName({})).toBeNull();
  });

  it("normalizes typed driver names", () => {
    expect(normalizeDriverName("  satnam   singh ")).toBe("satnam singh");
    expect(normalizeDriverName("")).toBe("");
  });
});
