import { describe, expect, it } from "vitest";
import {
  formatComplianceCountdown,
  getRemainingWindowMinutes,
  getWorkWindowStatusLabel,
} from "@/lib/driver-action-format";

describe("getRemainingWindowMinutes", () => {
  it("returns minutes left in the work window", () => {
    expect(getRemainingWindowMinutes(120, 300)).toBe(180);
    expect(getRemainingWindowMinutes(400, 300)).toBe(0);
  });
});

describe("formatComplianceCountdown", () => {
  it("formats hours and minutes", () => {
    expect(formatComplianceCountdown(195)).toBe("3h 15m");
    expect(formatComplianceCountdown(60)).toBe("1h");
    expect(formatComplianceCountdown(14.2)).toBe("15m");
  });
});

describe("getWorkWindowStatusLabel", () => {
  it("maps remaining minutes to status copy", () => {
    expect(getWorkWindowStatusLabel(120)).toBe("WORK WINDOW LEFT");
    expect(getWorkWindowStatusLabel(30)).toBe("BREAK DUE SOON");
    expect(getWorkWindowStatusLabel(0)).toBe("BREAK REQUIRED NOW");
  });
});
