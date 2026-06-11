import { describe, expect, it } from "vitest";
import {
  canEnterLobbyBranch,
  hasMinRole,
  isDriverFieldRole,
  isFleetManagerRole,
  isOwnerRole,
  normalizeUserRole,
} from "./roles";

describe("roles", () => {
  it("normalizes null to driver", () => {
    expect(normalizeUserRole(null)).toBe("driver");
  });

  it("ranks owner above manager", () => {
    expect(hasMinRole("owner", "manager")).toBe(true);
    expect(hasMinRole("manager", "owner")).toBe(false);
  });

  it("fleet manager includes owner and manager", () => {
    expect(isFleetManagerRole("manager")).toBe(true);
    expect(isFleetManagerRole("owner")).toBe(true);
    expect(isFleetManagerRole(null)).toBe(false);
  });

  it("field driver role excludes managers and owners", () => {
    expect(isDriverFieldRole(null)).toBe(true);
    expect(isDriverFieldRole("manager")).toBe(false);
    expect(isDriverFieldRole("owner")).toBe(false);
  });

  it("identifies owner role", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("manager")).toBe(false);
  });

  it("lobby driver branch is for field-driver accounts only", () => {
    expect(canEnterLobbyBranch("driver", null)).toBe(true);
    expect(canEnterLobbyBranch("driver", "manager")).toBe(false);
    expect(canEnterLobbyBranch("driver", "owner")).toBe(false);
  });

  it("lobby manager branch requires manager or owner", () => {
    expect(canEnterLobbyBranch("manager", null)).toBe(false);
    expect(canEnterLobbyBranch("manager", "manager")).toBe(true);
    expect(canEnterLobbyBranch("manager", "owner")).toBe(true);
  });

  it("lobby owner branch requires owner", () => {
    expect(canEnterLobbyBranch("owner", "manager")).toBe(false);
    expect(canEnterLobbyBranch("owner", "owner")).toBe(true);
  });
});
