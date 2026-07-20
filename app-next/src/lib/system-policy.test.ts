import { afterEach, describe, expect, it } from "vitest";
import {
  driverWritesBlocked,
  loginBlockedForRole,
  managerWritesBlocked,
  resolveGpsMovementTrailEnabled,
  sheetWritesBlocked,
} from "./system-policy";

const locked = {
  loginDisabled: true,
  driverWritesDisabled: true,
  managerWritesDisabled: true,
  gpsMovementTrailEnabled: false,
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

describe("resolveGpsMovementTrailEnabled", () => {
  const prev = process.env.GPS_MOVEMENT_TRAIL_ENABLED;
  const prevPublic = process.env.NEXT_PUBLIC_GPS_MOVEMENT_TRAIL_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.GPS_MOVEMENT_TRAIL_ENABLED;
    else process.env.GPS_MOVEMENT_TRAIL_ENABLED = prev;
    if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_GPS_MOVEMENT_TRAIL_ENABLED;
    else process.env.NEXT_PUBLIC_GPS_MOVEMENT_TRAIL_ENABLED = prevPublic;
  });

  it("uses policy when env unset", () => {
    delete process.env.GPS_MOVEMENT_TRAIL_ENABLED;
    delete process.env.NEXT_PUBLIC_GPS_MOVEMENT_TRAIL_ENABLED;
    expect(resolveGpsMovementTrailEnabled(false)).toBe(false);
    expect(resolveGpsMovementTrailEnabled(true)).toBe(true);
  });

  it("env false forces off", () => {
    process.env.GPS_MOVEMENT_TRAIL_ENABLED = "false";
    expect(resolveGpsMovementTrailEnabled(true)).toBe(false);
  });
});
