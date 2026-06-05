import { describe, expect, it } from "vitest";
import { DEVICE_BACKUP_SCHEMA_VERSION, MAX_DEVICE_SNAPSHOTS, formatBackupTime } from "@/lib/device-backup";

describe("device-backup", () => {
  it("uses schema version 1", () => {
    expect(DEVICE_BACKUP_SCHEMA_VERSION).toBe(1);
  });

  it("keeps at most 5 snapshots", () => {
    expect(MAX_DEVICE_SNAPSHOTS).toBe(5);
  });

  it("formatBackupTime handles null", () => {
    expect(formatBackupTime(null)).toBe("Never");
  });

  it("formatBackupTime formats Perth time", () => {
    const label = formatBackupTime(Date.parse("2026-06-05T06:00:00Z"));
    expect(label).toMatch(/Jun/);
  });
});
