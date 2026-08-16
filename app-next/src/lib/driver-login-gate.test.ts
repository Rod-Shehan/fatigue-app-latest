import { describe, expect, it } from "vitest";
import {
  normalizeLoginEmail,
  requiresApprovedDriverRoster,
  ROSTER_LOGIN_ERROR,
} from "@/lib/driver-login-gate";
import { CLIENT_PAUSED_ERROR, CLIENT_PAUSED_MESSAGE } from "@/lib/tenant";

describe("driver login gate", () => {
  it("normalizes email", () => {
    expect(normalizeLoginEmail("  Driver@Fleet.COM  ")).toBe("driver@fleet.com");
  });

  it("requires roster for field drivers only", () => {
    expect(requiresApprovedDriverRoster(null)).toBe(true);
    expect(requiresApprovedDriverRoster(undefined)).toBe(true);
    expect(requiresApprovedDriverRoster("manager")).toBe(false);
    expect(requiresApprovedDriverRoster("owner")).toBe(false);
  });

  it("exports stable roster error code for lobby", () => {
    expect(ROSTER_LOGIN_ERROR).toBe("not_on_roster");
  });

  it("exports a distinct paused-client message", () => {
    expect(CLIENT_PAUSED_ERROR).toBe("client_paused");
    expect(CLIENT_PAUSED_MESSAGE).toMatch(/paused/i);
  });
});
