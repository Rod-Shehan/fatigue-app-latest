import { prisma } from "@/lib/prisma";
import { isOwnerRole } from "@/lib/roles";

export type SystemPolicySnapshot = {
  loginDisabled: boolean;
  driverWritesDisabled: boolean;
  managerWritesDisabled: boolean;
  maintenanceMessage: string | null;
  updatedAt: string;
};

const DEFAULT_POLICY: SystemPolicySnapshot = {
  loginDisabled: false,
  driverWritesDisabled: false,
  managerWritesDisabled: false,
  maintenanceMessage: null,
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
    maintenanceMessage: row.maintenanceMessage,
    updatedAt: row.updatedAt.toISOString(),
  };
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
