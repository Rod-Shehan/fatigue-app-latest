import { describe, expect, it } from "vitest";
import {
  dayEventsIncludeStop,
  END_SHIFT_END_KM_REQUIRED_MESSAGE,
  validateEndKmsRequiredForStop,
} from "./end-shift-kms";

describe("dayEventsIncludeStop", () => {
  it("detects stop among events", () => {
    expect(dayEventsIncludeStop([{ type: "work" }, { type: "stop" }])).toBe(true);
    expect(dayEventsIncludeStop([{ type: "work" }])).toBe(false);
    expect(dayEventsIncludeStop([])).toBe(false);
  });
});

describe("validateEndKmsRequiredForStop", () => {
  it("allows missing end km when there is no stop", () => {
    expect(validateEndKmsRequiredForStop([{ type: "work" }], null)).toBeNull();
  });

  it("requires end km when stop is present and prior day has no end km", () => {
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], null)).toBe(
      END_SHIFT_END_KM_REQUIRED_MESSAGE
    );
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], -1)).toBe(
      END_SHIFT_END_KM_REQUIRED_MESSAGE
    );
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], 102000)).toBeNull();
  });

  it("allows empty end km when prior day holds overnight end km and start chains", () => {
    const sheetDays = [{ end_kms: 754481 }, { start_kms: 754481, end_kms: null }];
    expect(
      validateEndKmsRequiredForStop([{ type: "stop" }], null, {
        sheetDays,
        dayIndex: 1,
        dayStartKms: 754481,
      })
    ).toBeNull();
  });

  it("allows empty end km when prior day has end km and this card has no start yet", () => {
    const sheetDays = [{ end_kms: 754481 }, { end_kms: null }];
    expect(
      validateEndKmsRequiredForStop([{ type: "stop" }], null, {
        sheetDays,
        dayIndex: 1,
        dayStartKms: null,
      })
    ).toBeNull();
  });

  it("still requires end km when start does not match prior end", () => {
    const sheetDays = [{ end_kms: 754481 }, { start_kms: 900000, end_kms: null }];
    expect(
      validateEndKmsRequiredForStop([{ type: "stop" }], null, {
        sheetDays,
        dayIndex: 1,
        dayStartKms: 900000,
      })
    ).toBe(END_SHIFT_END_KM_REQUIRED_MESSAGE);
  });
});
