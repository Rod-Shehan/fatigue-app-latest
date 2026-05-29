import { describe, expect, it } from "vitest";
import { isPastRegulatoryWeek } from "@/lib/weeks";
import {
  canDriverEditSheetContent,
  canDriverLogOnSheet,
  managerRequiresAmendmentReason,
  patchIsAttestationOnly,
  patchTouchesContent,
} from "./sheet-record";

describe("isPastRegulatoryWeek", () => {
  it("past week before this Sunday", () => {
    expect(isPastRegulatoryWeek("2026-03-22", "2026-05-24")).toBe(true);
  });
  it("current week is not past", () => {
    expect(isPastRegulatoryWeek("2026-05-24", "2026-05-24")).toBe(false);
  });
});

describe("driver capabilities", () => {
  it("cannot log on past week", () => {
    expect(canDriverLogOnSheet("2026-03-22", "draft")).toBe(false);
  });
  it("can log on current draft", () => {
    expect(canDriverLogOnSheet("2026-05-24", "draft")).toBe(true);
  });
  it("cannot edit completed current week", () => {
    expect(canDriverEditSheetContent("2026-05-24", "completed")).toBe(false);
  });
});

describe("patch classification", () => {
  it("detects content patch", () => {
    expect(patchTouchesContent({ days: [] })).toBe(true);
    expect(patchTouchesContent({ signature: "x" })).toBe(false);
  });
  it("attestation only", () => {
    expect(
      patchIsAttestationOnly({
        signature: "data:image/png;base64,x",
        signed_at: "2026-01-01T00:00:00.000Z",
        status: "completed",
      })
    ).toBe(true);
    expect(patchIsAttestationOnly({ days: [], status: "completed" })).toBe(false);
  });
  it("manager reason on past content", () => {
    expect(
      managerRequiresAmendmentReason("2026-03-22", "draft", { days: [] })
    ).toBe(true);
    expect(
      managerRequiresAmendmentReason("2026-05-24", "draft", { days: [] })
    ).toBe(false);
  });
});
