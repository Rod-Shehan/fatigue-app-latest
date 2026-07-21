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

  it("requires end km when stop is present", () => {
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], null)).toBe(
      END_SHIFT_END_KM_REQUIRED_MESSAGE
    );
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], -1)).toBe(
      END_SHIFT_END_KM_REQUIRED_MESSAGE
    );
    expect(validateEndKmsRequiredForStop([{ type: "stop" }], 102000)).toBeNull();
  });
});
