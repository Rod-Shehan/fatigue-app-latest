/**
 * Client container identity (ADR 0005).
 * Every EWD list/get/create is scoped to the signed-in user's tenantId.
 */

export const DEFAULT_TENANT_ID = "tenant_default";
export const DEFAULT_TENANT_SLUG = "default";
export const DEFAULT_TENANT_LEGAL_NAME = "Default operator";

export const EMAIL_OTHER_TENANT_ERROR = "This email already belongs to another organisation.";

export function normalizeTenantSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function parseTenantLegalName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 160) return null;
  return name;
}

export function tenantWhere(tenantId: string): { tenantId: string } {
  return { tenantId };
}

export function isSameTenant(rowTenantId: string | null | undefined, sessionTenantId: string | null | undefined): boolean {
  return Boolean(rowTenantId && sessionTenantId && rowTenantId === sessionTenantId);
}

export function platformAdminEmailsFromEnv(raw = process.env.CIRCADIA_PLATFORM_ADMIN_EMAILS): Set<string> {
  if (typeof raw !== "string" || !raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isPlatformAdminUser(user: {
  platformAdmin?: boolean | null;
  email?: string | null;
}): boolean {
  if (user.platformAdmin) return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  return platformAdminEmailsFromEnv().has(email);
}

export type SheetTenantAccess = {
  userId: string;
  tenantId: string;
  isManager: boolean;
};

/** Same-tenant first. Managers see all sheets in their tenant; drivers see their own. */
export function canAccessSheet(
  sheet: { createdById: string | null; tenantId: string },
  access: SheetTenantAccess
): boolean {
  if (!isSameTenant(sheet.tenantId, access.tenantId)) return false;
  if (access.isManager) return true;
  return sheet.createdById === access.userId;
}
