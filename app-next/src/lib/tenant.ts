/**
 * Client container identity (ADR 0005).
 * Every EWD list/get/create is scoped to the signed-in user's tenantId.
 */

export const DEFAULT_TENANT_ID = "tenant_default";
export const DEFAULT_TENANT_SLUG = "default";
export const DEFAULT_TENANT_LEGAL_NAME = "Default operator";

export const EMAIL_OTHER_TENANT_ERROR = "This email already belongs to another organisation.";
export const CLIENT_PAUSED_ERROR = "client_paused";
export const CLIENT_PAUSED_MESSAGE =
  "This organisation is paused. Contact Circadia24 if you should still have access.";

export const TENANT_STATUSES = ["active", "paused"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const DEFAULT_CLIENT_ENTITLEMENTS = {
  ewd: true,
  enterprise: true,
  gpsTrail: false,
  checklists: true,
  camera: false,
  command: false,
  frms: false,
  photoRetain: false,
} as const;

export type ClientEntitlements = {
  [K in keyof typeof DEFAULT_CLIENT_ENTITLEMENTS]: boolean;
};

export const ENTITLEMENT_LABELS: Record<keyof ClientEntitlements, string> = {
  ewd: "EWD (driver diary)",
  enterprise: "Enterprise (fleet manager)",
  gpsTrail: "GPS movement trail",
  checklists: "Checklists (FFW / Prestart / Load)",
  camera: "Camera / live alerts",
  command: "Circadia Command desk",
  frms: "FRMS heatmap",
  photoRetain: "Photo retain (paid)",
};

export function parseTenantStatus(raw: unknown): TenantStatus | null {
  if (raw === "active" || raw === "paused") return raw;
  return null;
}

export function parseClientEntitlements(raw: unknown): ClientEntitlements {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_CLIENT_ENTITLEMENTS };
  for (const key of Object.keys(DEFAULT_CLIENT_ENTITLEMENTS) as (keyof ClientEntitlements)[]) {
    if (typeof src[key] === "boolean") out[key] = src[key];
  }
  return out;
}

export function parseRecordsInbox(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/** Paused clients cannot sign in. Circadia platform admins still can (their home tenant may be paused). */
export function assertClientLoginAllowed(args: {
  tenantStatus: string | null | undefined;
  user: { platformAdmin?: boolean | null; email?: string | null };
}): void {
  if (parseTenantStatus(args.tenantStatus) !== "paused") return;
  if (isPlatformAdminUser(args.user)) return;
  throw new Error(CLIENT_PAUSED_ERROR);
}

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
