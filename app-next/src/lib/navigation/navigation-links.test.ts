import { describe, expect, it } from "vitest";
import {
  ALL_NAVIGATION_LINKS,
  DRIVER_FORBIDDEN_HREF_PREFIXES,
  DRIVER_SETTINGS_CONNECT_LINKS,
  DRIVER_SETTINGS_DRIVE_LINKS,
  MANAGER_DOMAIN_ANCHOR_LINKS,
  MANAGER_LOGIN_HREF,
} from "@/lib/navigation/navigation-links";
import {
  isLinkAllowedOnSurface,
  parseHref,
  resolveRouteAudience,
} from "@/lib/navigation/route-access";

describe("navigation link manifest", () => {
  it("has unique ids across all surfaces", () => {
    const ids = ALL_NAVIGATION_LINKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("allows every manifest link on its declared surface", () => {
    for (const link of ALL_NAVIGATION_LINKS) {
      const result = isLinkAllowedOnSurface(link.href, link.surface, link.kind ?? "route");
      expect(result, `${link.id}: ${"reason" in result ? result.reason : "ok"}`).toEqual({ ok: true });
    }
  });

  it("driver settings never links to manager-only routes", () => {
    const driverSettings = [...DRIVER_SETTINGS_DRIVE_LINKS, ...DRIVER_SETTINGS_CONNECT_LINKS];
    for (const link of driverSettings) {
      if (link.kind === "login-redirect") continue;
      const audience = resolveRouteAudience(link.href);
      expect(audience, link.id).not.toBe("manager");
      expect(audience, link.id).not.toBe("owner");
      for (const prefix of DRIVER_FORBIDDEN_HREF_PREFIXES) {
        expect(link.href.startsWith(prefix), `${link.id} must not start with ${prefix}`).toBe(false);
      }
    }
  });

  it("route catalogue points at driver routes page not admin", () => {
    const routeCatalogue = DRIVER_SETTINGS_DRIVE_LINKS.find((l) => l.id === "route-catalogue");
    expect(routeCatalogue?.href).toBe("/driver/routes");
    expect(routeCatalogue?.href).not.toContain("/admin/");
  });

  it("manager login link uses manager branch on lobby", () => {
    const parsed = parseHref(MANAGER_LOGIN_HREF);
    expect(parsed.kind).toBe("login");
    if (parsed.kind === "login") {
      expect(parsed.pathname).toBe("/");
      expect(parsed.searchParams.get("branch")).toBe("manager");
      expect(parsed.searchParams.get("callbackUrl")).toBe("/manager");
    }
  });

  it("domain overview anchors match manager section ids", () => {
    for (const link of MANAGER_DOMAIN_ANCHOR_LINKS) {
      expect(link.kind).toBe("anchor");
      expect(link.href.startsWith("#")).toBe(true);
    }
  });

  it("rejects driver surface linking to admin routes", () => {
    const result = isLinkAllowedOnSurface("/admin/routes", "driver-settings", "route");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("manager-only");
    }
  });
});

describe("resolveRouteAudience", () => {
  it("classifies common paths", () => {
    expect(resolveRouteAudience("/driver/routes")).toBe("driver");
    expect(resolveRouteAudience("/admin/routes")).toBe("manager");
    expect(resolveRouteAudience("/manager")).toBe("manager");
    expect(resolveRouteAudience("/sheets")).toBe("driver");
    expect(resolveRouteAudience("/sheets/00000000-0000-4000-8000-000000000000")).toBe("shared");
    expect(resolveRouteAudience("#risk-analysis")).toBe("anchor");
    expect(resolveRouteAudience(MANAGER_LOGIN_HREF)).toBe("public");
  });
});
