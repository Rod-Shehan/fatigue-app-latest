import { describe, it, expect } from "vitest";
import { isSheetOwnedByDriver, sheetHasLegacyDriverEventTags } from "./sheet-ownership";

describe("sheet-ownership", () => {
  it("matches sheet owner by driver_name only", () => {
    expect(isSheetOwnedByDriver({ driver_name: "Rod" }, "Rod")).toBe(true);
    expect(isSheetOwnedByDriver({ driver_name: "Rod" }, "Jane")).toBe(false);
  });

  it("detects legacy per-event driver tags", () => {
    expect(
      sheetHasLegacyDriverEventTags({
        days: [{ events: [{ driver: "second" }] }],
      })
    ).toBe(true);
    expect(
      sheetHasLegacyDriverEventTags({
        days: [{ events: [{ type: "work", time: "2026-01-01T08:00:00" }] }],
      })
    ).toBe(false);
  });
});
