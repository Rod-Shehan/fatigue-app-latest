import { describe, it, expect } from "vitest";
import { daysFromTodayToYmd, getCvdMedicalBannerKind, parseRequiredYmdDate } from "./cvd-medical";

describe("cvd-medical", () => {
  it("getCvdMedicalBannerKind returns none for empty", () => {
    expect(getCvdMedicalBannerKind(null)).toBe("none");
    expect(getCvdMedicalBannerKind("")).toBe("none");
  });

  it("getCvdMedicalBannerKind expired when date in past", () => {
    expect(getCvdMedicalBannerKind("1990-01-01")).toBe("expired");
  });

  it("daysFromTodayToYmd is negative for past", () => {
    expect(daysFromTodayToYmd("1990-01-01")).toBeLessThan(0);
  });

  it("parseRequiredYmdDate accepts YYYY-MM-DD only", () => {
    expect(parseRequiredYmdDate("2026-03-01")).toEqual(new Date("2026-03-01T12:00:00.000Z"));
    expect(parseRequiredYmdDate("")).toBeNull();
    expect(parseRequiredYmdDate(null)).toBeNull();
  });
});
