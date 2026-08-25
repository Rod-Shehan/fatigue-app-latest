import { describe, expect, it } from "vitest";
import {
  DRIVER_ADD_LOAD_CHECK_LABEL,
  formatAddLoadCheckLabel,
} from "./product-copy";

describe("formatAddLoadCheckLabel", () => {
  it("omits the count when none are saved today", () => {
    expect(formatAddLoadCheckLabel(0)).toBe(DRIVER_ADD_LOAD_CHECK_LABEL);
  });

  it("shows how many load forms are saved today", () => {
    expect(formatAddLoadCheckLabel(2)).toBe(`${DRIVER_ADD_LOAD_CHECK_LABEL} · 2 today`);
  });
});
