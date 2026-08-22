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

  it("treats passenger as work time that never becomes non-work, shift still open", () => {
    expect(isOpenShiftEventType("passenger")).toBe(true);
    expect(isBreakFromDrivingEventType("passenger")).toBe(true);
    expect(isWorkTimeEventType("passenger")).toBe(false);
    expect(toCoverageKind("passenger")).toBe("other_work");
    expect(toAmiEventType("passenger")).toBe("other_work");
  });

  it("treats sleeper berth as non-work while the shift stays open", () => {
    expect(isOpenShiftEventType("sleeper_berth")).toBe(true);
    expect(isBreakFromDrivingEventType("sleeper_berth")).toBe(false);
    expect(isWorkTimeEventType("sleeper_berth")).toBe(false);
    expect(toCoverageKind("sleeper_berth")).toBe("non_work");
    expect(toAmiEventType("sleeper_berth")).toBe("non_work");
    expect(isOpenShiftEventType("stop")).toBe(false);
  });
});
