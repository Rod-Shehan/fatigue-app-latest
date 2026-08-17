import { describe, expect, it } from "vitest";
import {
  appSurfaceFromHost,
  documentTitleForSurface,
  isPathAllowedOnSurface,
  lobbyBranchesForSurface,
  resolveAppSurface,
} from "./app-surface";

describe("app-surface", () => {
  it("infers surface from subdomain host", () => {
    expect(appSurfaceFromHost("ewd.circadia24.com")).toBe("ewd");
    expect(appSurfaceFromHost("enterprise.circadia24.com")).toBe("enterprise");
    expect(appSurfaceFromHost("legacy.circadia24.com")).toBe("legacy");
    expect(appSurfaceFromHost("admin.circadia24.com")).toBe("circadia");
    expect(appSurfaceFromHost("www.circadia24.com")).toBe(null);
  });

  it("prefers env over host except admin desk", () => {
    expect(
      resolveAppSurface({
        envValue: "enterprise",
        host: "ewd.circadia24.com",
      })
    ).toBe("enterprise");
    expect(
      resolveAppSurface({
        envValue: "legacy",
        host: "admin.circadia24.com",
      })
    ).toBe("circadia");
  });

  it("defaults to legacy", () => {
    expect(resolveAppSurface({})).toBe("legacy");
  });

  it("filters lobby branches by surface", () => {
    expect(lobbyBranchesForSurface("ewd")).toEqual(["driver"]);
    expect(lobbyBranchesForSurface("enterprise")).toEqual(["manager", "owner"]);
    expect(lobbyBranchesForSurface("legacy")).toEqual(["driver", "manager", "owner"]);
    expect(lobbyBranchesForSurface("circadia")).toEqual([]);
  });

  it("gates driver paths off enterprise and manager paths off ewd", () => {
    expect(isPathAllowedOnSurface("/driver", "enterprise")).toBe(false);
    expect(isPathAllowedOnSurface("/sheets", "enterprise")).toBe(false);
    expect(isPathAllowedOnSurface("/sheets/abc", "enterprise")).toBe(true);
    expect(isPathAllowedOnSurface("/manager", "enterprise")).toBe(true);

    expect(isPathAllowedOnSurface("/manager", "ewd")).toBe(false);
    expect(isPathAllowedOnSurface("/driver", "ewd")).toBe(true);
    expect(isPathAllowedOnSurface("/sheets/new", "ewd")).toBe(true);

    expect(isPathAllowedOnSurface("/manager", "legacy")).toBe(true);
    expect(isPathAllowedOnSurface("/driver", "legacy")).toBe(true);
    expect(isPathAllowedOnSurface("/reset-password", "ewd")).toBe(true);
    expect(isPathAllowedOnSurface("/reset-password", "enterprise")).toBe(true);
    expect(isPathAllowedOnSurface("/circadia", "enterprise")).toBe(true);
    expect(isPathAllowedOnSurface("/circadia/clients/abc", "enterprise")).toBe(true);
    expect(isPathAllowedOnSurface("/circadia", "ewd")).toBe(false);
    expect(isPathAllowedOnSurface("/circadia", "circadia")).toBe(true);
    expect(isPathAllowedOnSurface("/manager", "circadia")).toBe(false);
    expect(isPathAllowedOnSurface("/admin/security", "circadia")).toBe(false);
  });

  it("builds document titles per product surface", () => {
    expect(documentTitleForSurface("ewd")).toBe("Circadia24 EWD");
    expect(documentTitleForSurface("enterprise")).toBe("Circadia24 Enterprise");
    expect(documentTitleForSurface("legacy")).toBe("Circadia24 Helper");
    expect(documentTitleForSurface("circadia")).toBe("Circadia24 Client Manager");
  });
});
