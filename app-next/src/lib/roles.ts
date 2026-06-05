/** Ordered roles: driver < manager < owner */
export const USER_ROLE = {
  DRIVER: null,
  MANAGER: "manager",
  OWNER: "owner",
} as const;

export type UserRole = typeof USER_ROLE.MANAGER | typeof USER_ROLE.OWNER | null;

const ROLE_RANK: Record<string, number> = {
  driver: 0,
  manager: 1,
  owner: 2,
};

export function normalizeUserRole(role: string | null | undefined): "driver" | "manager" | "owner" {
  if (role === "owner") return "owner";
  if (role === "manager") return "manager";
  return "driver";
}

export function roleRank(role: string | null | undefined): number {
  return ROLE_RANK[normalizeUserRole(role)] ?? 0;
}

export function hasMinRole(role: string | null | undefined, minimum: "manager" | "owner"): boolean {
  const minRank = minimum === "owner" ? ROLE_RANK.owner : ROLE_RANK.manager;
  return roleRank(role) >= minRank;
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "owner";
}

/** Fleet manager dashboard + APIs (managers and owners). */
export function isFleetManagerRole(role: string | null | undefined): boolean {
  return hasMinRole(role, "manager");
}

/** Field driver offline session — not managers or owners. */
export function isDriverFieldRole(role: string | null | undefined): boolean {
  return !hasMinRole(role, "manager");
}
