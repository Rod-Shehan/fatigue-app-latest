import { describe, expect, it } from "vitest";
import {
  driverWritesBlocked,
  loginBlockedForRole,
  managerWritesBlocked,
  sheetWritesBlocked,
} from "./system-policy";

const locked = {
  loginDisabled: true,
  driverWritesDisabled: true,
  managerWritesDisabled: true,
  maintenanceMessage: null,
  updatedAt: new Date().toISOString(),
};

describe("system-policy", () => {
  it("blocks non-owner login when login disabled", () => {
    expect(loginBlockedForRole(locked, "manager")).toBe(true);
    expect(loginBlockedForRole(locked, null)).toBe(true);
    expect(loginBlockedForRole(locked, "owner")).toBe(false);
  });

  it("blocks driver and manager writes separately", () => {
    expect(driverWritesBlocked(locked)).toBe(true);
    expect(managerWritesBlocked(locked)).toBe(true);
  });

  it("owner bypasses sheet write lockdown", () => {
    expect(sheetWritesBlocked(locked, { isManager: true, isOwner: true })).toBeNull();
    expect(sheetWritesBlocked(locked, { isManager: false, isOwner: false })).toMatch(/Driver/);
    expect(sheetWritesBlocked(locked, { isManager: true, isOwner: false })).toMatch(/Manager/);
  });
});
