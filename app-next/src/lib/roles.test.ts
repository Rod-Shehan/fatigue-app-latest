import { describe, expect, it } from "vitest";
import { hasMinRole, isDriverFieldRole, isFleetManagerRole, isOwnerRole, normalizeUserRole } from "./roles";

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
});
