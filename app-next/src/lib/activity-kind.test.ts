import { describe, expect, it } from "vitest";
import {
  isBreakFromDrivingEventType,
  isOpenShiftEventType,
  isWorkTimeEventType,
  toAmiEventType,
  toCoverageKind,
} from "./activity-kind";

describe("activity-kind", () => {
  it("treats other_work as a break from driving, not driving work", () => {
    expect(isBreakFromDrivingEventType("other_work")).toBe(true);
    expect(isWorkTimeEventType("other_work")).toBe(false);
    expect(toCoverageKind("other_work")).toBe("other_work");
    expect(toAmiEventType("other_work")).toBe("other_work");
  });

  it("keeps rest as break so 31+ conversion still applies", () => {
    expect(toCoverageKind("break")).toBe("break");
    expect(isBreakFromDrivingEventType("break")).toBe(true);
    expect(isWorkTimeEventType("break")).toBe(false);
  });

  it("treats other_work as an open shift", () => {
    expect(isOpenShiftEventType("other_work")).toBe(true);
    expect(isOpenShiftEventType("stop")).toBe(false);
    expect(isOpenShiftEventType(null)).toBe(false);
  });
});
