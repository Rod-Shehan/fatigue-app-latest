import { describe, expect, it } from "vitest";
import { getThisWeekSunday, isPastRegulatoryWeek } from "@/lib/weeks";
import {
  canDriverAttestSheet,
  canDriverEditSheetContent,
  canDriverLogOnSheet,
  isPrematureCurrentWeekAttestation,
  managerRequiresAmendmentReason,
  patchIsAttestationOnly,
  patchTouchesContent,
  driverWeekListStatusLabel,
  isUnsignedPastWeekSheet,
  sheetHasDriverAttestation,
  sheetIsUnsignedForDriver,
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
  const thisWeek = getThisWeekSunday();
  const pastWeek = "2020-01-05";

  it("unsigned past week is editable", () => {
    expect(sheetIsUnsignedForDriver("draft", null)).toBe(true);
    expect(canDriverEditSheetContent(pastWeek, "draft", null)).toBe(true);
  });
  it("draft with a week signature is attested", () => {
    expect(sheetIsUnsignedForDriver("draft", "data:image/png;base64,x")).toBe(false);
    expect(sheetIsUnsignedForDriver("draft", "   ")).toBe(true);
  });
  it("cannot log live on past week even when unsigned", () => {
    expect(canDriverLogOnSheet(pastWeek, "draft", null)).toBe(false);
  });
  it("can log live on current unsigned week", () => {
    expect(canDriverLogOnSheet(thisWeek, "draft", null)).toBe(true);
  });
  it("cannot sign current regulatory week until it ends", () => {
    expect(canDriverAttestSheet(thisWeek, "draft", null)).toBe(false);
  });
  it("can sign unsigned past week", () => {
    expect(canDriverAttestSheet(pastWeek, "draft", null)).toBe(true);
  });
  it("cannot attest when already signed", () => {
    expect(canDriverAttestSheet(pastWeek, "completed", "data:image/png;base64,x")).toBe(false);
  });
  it("detects premature attestation on current week", () => {
    expect(isPrematureCurrentWeekAttestation(thisWeek, "completed", null)).toBe(true);
    expect(isPrematureCurrentWeekAttestation(thisWeek, "draft", "data:image/png;base64,x")).toBe(true);
    expect(isPrematureCurrentWeekAttestation(thisWeek, "draft", null)).toBe(false);
    expect(isPrematureCurrentWeekAttestation(pastWeek, "completed", "sig")).toBe(false);
  });
  it("cannot edit signed sheet", () => {
    expect(canDriverEditSheetContent("2026-05-24", "completed", "data:image/png;base64,x")).toBe(false);
  });
  it("cannot edit completed without signature field but status completed", () => {
    expect(canDriverEditSheetContent("2026-05-24", "completed", null)).toBe(false);
  });
  it("lists a past week as needing a signature only when it is not attested", () => {
    expect(isUnsignedPastWeekSheet("2026-10-11", "draft", null, "2026-10-18")).toBe(true);
    expect(isUnsignedPastWeekSheet("2026-10-11", "draft", "data:image/png;base64,x", "2026-10-18")).toBe(
      false
    );
    expect(isUnsignedPastWeekSheet("2026-10-11", "completed", null, "2026-10-18")).toBe(false);
    expect(isUnsignedPastWeekSheet("2026-10-18", "draft", null, "2026-10-18")).toBe(false);
    expect(
      driverWeekListStatusLabel({
        weekStarting: "2026-10-11",
        status: "draft",
        signature: null,
        thisWeekSunday: "2026-10-18",
      })
    ).toBe("Needs signature");
    expect(
      driverWeekListStatusLabel({
        weekStarting: "2026-10-11",
        status: "draft",
        signature: "data:image/png;base64,x",
        thisWeekSunday: "2026-10-18",
      })
    ).toBe("Signed");
    expect(sheetHasDriverAttestation("draft", "data:image/png;base64,x")).toBe(true);
  });
});

describe("patch classification", () => {
  const thisWeek = getThisWeekSunday();

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
      managerRequiresAmendmentReason("2020-01-05", "draft", { days: [] })
    ).toBe(true);
    expect(
      managerRequiresAmendmentReason(thisWeek, "draft", { days: [] })
    ).toBe(false);
  });
});
