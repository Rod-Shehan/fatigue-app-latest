import { describe, expect, it } from "vitest";
import { formatLastOfficeSyncLabel } from "./office-sync-status";
import { LAST_OFFICE_SAVE_PREFIX } from "./product-copy";

describe("office-sync-status", () => {
  it("formats a last office save line", () => {
    const label = formatLastOfficeSyncLabel("2026-10-19T06:00:00.000Z", LAST_OFFICE_SAVE_PREFIX);
    expect(label).toContain(LAST_OFFICE_SAVE_PREFIX);
    expect(label).toContain("2026");
  });

  it("returns null when there is no office save yet", () => {
    expect(formatLastOfficeSyncLabel(null, LAST_OFFICE_SAVE_PREFIX)).toBeNull();
  });
});
