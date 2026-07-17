import { describe, expect, it, vi } from "vitest";
import {
  appSurfaceFromHost,
  isPathAllowedOnSurface,
  lobbyBranchesForSurface,
  redirectForBlockedPath,
  resolveAppSurface,
} from "./app-surface";

describe("app-surface", () => {
  it("infers surface from subdomain host", () => {
    expect(appSurfaceFromHost("ewd.circadia24.com")).toBe("ewd");
    expect(appSurfaceFromHost("enterprise.circadia24.com")).toBe("enterprise");
    expect(appSurfaceFromHost("legacy.circadia24.com")).toBe("legacy");
    expect(appSurfaceFromHost("www.circadia24.com")).toBe(null);
  });

  it("prefers env over host", () => {
    expect(
      resolveAppSurface({
        envValue: "enterprise",
        host: "ewd.circadia24.com",
      })
    ).toBe("enterprise");
  });

  it("defaults to legacy", () => {
    expect(resolveAppSurface({})).toBe("legacy");
  });

  it("filters lobby branches by surface", () => {
    expect(lobbyBranchesForSurface("ewd")).toEqual(["driver"]);
    expect(lobbyBranchesForSurface("enterprise")).toEqual(["manager", "owner"]);
    expect(lobbyBranchesForSurface("legacy")).toEqual(["driver", "manager", "owner"]);
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
  });

  it("builds sibling redirects when URLs are set", () => {
    vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_APP_URL", "https://enterprise.circadia24.com");
    const r = redirectForBlockedPath("/manager", "ewd");
    expect(r.external).toBe(true);
    expect(r.location).toBe("https://enterprise.circadia24.com/manager");
    vi.unstubAllEnvs();
  });
});
