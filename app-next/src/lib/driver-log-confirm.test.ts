import { describe, expect, it } from "vitest";
import {
  DRIVER_LOG_CONFIRM_WINDOW_MS,
  isDriverLogConfirmMatch,
} from "./driver-log-confirm";

describe("driver-log-confirm", () => {
  it("exposes an in-cab confirm window of at least 8 seconds", () => {
    expect(DRIVER_LOG_CONFIRM_WINDOW_MS).toBeGreaterThanOrEqual(8_000);
  });

  it("matches armed type and resume flag", () => {
    expect(
      isDriverLogConfirmMatch({ type: "work", episodeResume: false }, "work", false)
    ).toBe(true);
    expect(
      isDriverLogConfirmMatch({ type: "work", episodeResume: false }, "work", true)
    ).toBe(false);
    expect(
      isDriverLogConfirmMatch({ type: "work", episodeResume: false }, "break", false)
    ).toBe(false);
    expect(isDriverLogConfirmMatch(null, "work", false)).toBe(false);
  });
});
