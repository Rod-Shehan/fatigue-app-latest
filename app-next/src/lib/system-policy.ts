/**
 * System policy + optional enterprise addons.
 */

import { prisma } from "@/lib/prisma";
import { isOwnerRole } from "@/lib/roles";

export type SystemPolicySnapshot = {
  loginDisabled: boolean;
  driverWritesDisabled: boolean;
  managerWritesDisabled: boolean;
  /** GPS segment trail + Work/Break movement lock (addon; default off). */
  gpsMovementTrailEnabled: boolean;
  maintenanceMessage: string | null;
  /** WAHVA / defect reporting destination. */
  maintenanceContactName: string | null;
  maintenanceContactCompany: string | null;
  maintenanceContactEmail: string | null;
  maintenanceContactPhone: string | null;
  updatedAt: string;
};

const DEFAULT_POLICY: SystemPolicySnapshot = {
  loginDisabled: false,
  driverWritesDisabled: false,
  managerWritesDisabled: false,
  gpsMovementTrailEnabled: false,
  maintenanceMessage: null,
  maintenanceContactName: null,
  maintenanceContactCompany: null,
  maintenanceContactEmail: null,
  maintenanceContactPhone: null,
  updatedAt: new Date(0).toISOString(),
};

export async function ensureSystemPolicyRow() {
  return prisma.systemPolicy.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

export async function getSystemPolicy(): Promise<SystemPolicySnapshot> {
  const row = await prisma.systemPolicy.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_POLICY;
  return {
    loginDisabled: row.loginDisabled,
    driverWritesDisabled: row.driverWritesDisabled,
    managerWritesDisabled: row.managerWritesDisabled,
    gpsMovementTrailEnabled: row.gpsMovementTrailEnabled,
    maintenanceMessage: row.maintenanceMessage,
    maintenanceContactName: row.maintenanceContactName ?? null,
    maintenanceContactCompany: row.maintenanceContactCompany ?? null,
    maintenanceContactEmail: row.maintenanceContactEmail ?? null,
    maintenanceContactPhone: row.maintenanceContactPhone ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Env kill-switch / force-on for ops:
 * GPS_MOVEMENT_TRAIL_ENABLED=false|0 → always off
 * GPS_MOVEMENT_TRAIL_ENABLED=true|1 → always on
 * unset → SystemPolicy.gpsMovementTrailEnabled (addon flag)
 */
export function resolveGpsMovementTrailEnabled(policyEnabled: boolean): boolean {
  const raw = (
    process.env.GPS_MOVEMENT_TRAIL_ENABLED ??
    process.env.NEXT_PUBLIC_GPS_MOVEMENT_TRAIL_ENABLED ??
    ""
  )
    .trim()
    .toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") return false;
  if (raw === "true" || raw === "1" || raw === "on") return true;
  return policyEnabled;
}

export async function isGpsMovementTrailEnabled(): Promise<boolean> {
  const policy = await getSystemPolicy();
  return resolveGpsMovementTrailEnabled(policy.gpsMovementTrailEnabled);
}

export function loginBlockedForRole(
  policy: SystemPolicySnapshot,
  role: string | null | undefined
): boolean {
  if (!policy.loginDisabled) return false;
  return !isOwnerRole(role);
}

export function driverWritesBlocked(policy: SystemPolicySnapshot): boolean {
  return policy.driverWritesDisabled;
}

export function managerWritesBlocked(policy: SystemPolicySnapshot): boolean {
  return policy.managerWritesDisabled;
}

export type WriteAccessContext = {
  isManager: boolean;
  isOwner: boolean;
};

export function sheetWritesBlocked(
  policy: SystemPolicySnapshot,
  access: WriteAccessContext
): string | null {
  if (access.isOwner) return null;
  if (!access.isManager && policy.driverWritesDisabled) {
    return "Driver record updates are temporarily disabled by your organisation.";
  }
  if (access.isManager && policy.managerWritesDisabled) {
    return "Manager record updates are temporarily disabled by your organisation.";
  }
  return null;
}
