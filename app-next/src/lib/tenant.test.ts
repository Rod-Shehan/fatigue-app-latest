import { describe, expect, it } from "vitest";
import {
  assertClientLoginAllowed,
  CLIENT_PAUSED_ERROR,
  DEFAULT_CLIENT_ENTITLEMENTS,
  EMAIL_OTHER_TENANT_ERROR,
  isPlatformAdminUser,
  isSameTenant,
  normalizeTenantSlug,
  parseClientEntitlements,
  parseTenantLegalName,
  parseTenantStatus,
  platformAdminEmailsFromEnv,
  tenantWhere,
} from "./tenant";
import { canAccessSheet, type SheetTenantAccess } from "./tenant";

function access(partial: Partial<SheetTenantAccess> & Pick<SheetTenantAccess, "userId" | "tenantId">): SheetTenantAccess {
  return {
    isManager: false,
    ...partial,
  };
}

describe("tenant helpers", () => {
  it("normalizes slugs", () => {
    expect(normalizeTenantSlug(" Acme Haulage ")).toBe("acme-haulage");
    expect(normalizeTenantSlug("A")).toBe("a");
  });

  it("rejects empty legal names", () => {
    expect(parseTenantLegalName(" ")).toBeNull();
    expect(parseTenantLegalName("Acme Haulage Pty Ltd")).toBe("Acme Haulage Pty Ltd");
  });

  it("scopes where clauses", () => {
    expect(tenantWhere("t1")).toEqual({ tenantId: "t1" });
  });

  it("treats missing tenant as not the same", () => {
    expect(isSameTenant("t1", "t1")).toBe(true);
    expect(isSameTenant("t1", "t2")).toBe(false);
    expect(isSameTenant(null, "t1")).toBe(false);
  });

  it("reads platform admin emails from env list", () => {
    expect(platformAdminEmailsFromEnv("a@x.com, B@X.com")).toEqual(new Set(["a@x.com", "b@x.com"]));
    expect(isPlatformAdminUser({ platformAdmin: true, email: "x@y.com" })).toBe(true);
    expect(isPlatformAdminUser({ platformAdmin: false, email: null })).toBe(false);
  });
});

describe("canAccessSheet tenant isolation", () => {
  it("denies another tenant even for managers", () => {
    const sheet = { createdById: "u1", tenantId: "acme" };
    expect(canAccessSheet(sheet, access({ userId: "mgr", tenantId: "beta", isManager: true }))).toBe(false);
  });

  it("allows a manager in the same tenant", () => {
    const sheet = { createdById: "u1", tenantId: "acme" };
    expect(canAccessSheet(sheet, access({ userId: "mgr", tenantId: "acme", isManager: true }))).toBe(true);
  });

  it("allows the creating driver in the same tenant", () => {
    const sheet = { createdById: "u1", tenantId: "acme" };
    expect(canAccessSheet(sheet, access({ userId: "u1", tenantId: "acme" }))).toBe(true);
  });

  it("denies a driver from another tenant", () => {
    const sheet = { createdById: "u1", tenantId: "acme" };
    expect(canAccessSheet(sheet, access({ userId: "u1", tenantId: "beta" }))).toBe(false);
  });

  it("denies access when session has no tenant", () => {
    const sheet = { createdById: "u1", tenantId: "acme" };
    expect(canAccessSheet(sheet, access({ userId: "u1", tenantId: "" }))).toBe(false);
  });
});

describe("cross-tenant email", () => {
  it("keeps a stable error string for APIs", () => {
    expect(EMAIL_OTHER_TENANT_ERROR).toMatch(/another organisation/i);
  });
});

describe("client pack", () => {
  it("parses status", () => {
    expect(parseTenantStatus("paused")).toBe("paused");
    expect(parseTenantStatus("nope")).toBeNull();
  });

  it("fills entitlement defaults and keeps known booleans", () => {
    expect(parseClientEntitlements(null)).toEqual(DEFAULT_CLIENT_ENTITLEMENTS);
    expect(parseClientEntitlements({ camera: true, unknown: true }).camera).toBe(true);
    expect(parseClientEntitlements({ camera: true }).ewd).toBe(true);
  });

  it("blocks customer login when the client is paused", () => {
    expect(() =>
      assertClientLoginAllowed({ tenantStatus: "paused", user: { platformAdmin: false, email: "a@x.com" } })
    ).toThrow(CLIENT_PAUSED_ERROR);
    expect(() =>
      assertClientLoginAllowed({ tenantStatus: "paused", user: { platformAdmin: true, email: "staff@circadia24.com" } })
    ).not.toThrow();
    expect(() =>
      assertClientLoginAllowed({ tenantStatus: "active", user: { platformAdmin: false, email: "a@x.com" } })
    ).not.toThrow();
  });
});
