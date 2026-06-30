/**
 * Triage shift — read-only snapshot for Command triage banner (§3.5).
 * Writes and admin UI live in app-next; both apps share the Neon TriageShift table.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { CommandApiError } from "@/lib/errors";

export const TRIAGE_SHIFT_TIMEZONE = "Australia/Perth";

export const TRIAGE_SHIFT_ROLES = ["manager", "owner", "command_operator"] as const;
export type TriageShiftRole = (typeof TRIAGE_SHIFT_ROLES)[number];

export type TriageShiftAssignees = {
  userIds: string[];
  operatorIds: string[];
  roles: TriageShiftRole[];
};

export type TriageShiftAssigneeUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

export type TriageShiftAssigneeOperator = {
  operatorId: string;
  fullName: string;
  username: string | null;
  role: string;
};

export type TriageShiftRow = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  assignees: TriageShiftAssignees;
  handoffNote: string | null;
  updatedAt: Date;
};

export type TriageShiftSnapshot = {
  current: TriageShiftPublic | null;
  next: TriageShiftPublic | null;
  timezone: typeof TRIAGE_SHIFT_TIMEZONE;
};

export type TriageShiftPublic = {
  id: string;
  startsAt: string;
  endsAt: string;
  startsAtLabel: string;
  endsAtLabel: string;
  assignees: TriageShiftAssignees;
  assigneeUsers: TriageShiftAssigneeUser[];
  assigneeOperators: TriageShiftAssigneeOperator[];
  roleLabels: { role: TriageShiftRole; label: string; activeCount: number | null }[];
  handoffNote: string | null;
  updatedAt: string | null;
};

const ROLE_LABELS: Record<TriageShiftRole, string> = {
  manager: "Managers",
  owner: "Owners",
  command_operator: "Command operators",
};

function emptyAssignees(): TriageShiftAssignees {
  return { userIds: [], operatorIds: [], roles: [] };
}

export function parseAssignees(raw: unknown): TriageShiftAssignees {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyAssignees();
  const o = raw as Record<string, unknown>;
  const userIds = Array.isArray(o.userIds)
    ? [...new Set(o.userIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))]
    : [];
  const operatorIds = Array.isArray(o.operatorIds)
    ? [...new Set(o.operatorIds.filter((id): id is string => typeof id === "string" && id.trim() !== ""))]
    : [];
  const roles = Array.isArray(o.roles)
    ? ([
        ...new Set(
          o.roles.filter(
            (r): r is TriageShiftRole =>
              typeof r === "string" && (TRIAGE_SHIFT_ROLES as readonly string[]).includes(r)
          )
        ),
      ] as TriageShiftRole[])
    : [];
  return { userIds, operatorIds, roles };
}

export function formatPerthDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-AU", {
    timeZone: TRIAGE_SHIFT_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function isOperatorOnShift(
  assignees: TriageShiftAssignees,
  args: { operatorId: string }
): boolean {
  if (assignees.operatorIds.includes(args.operatorId)) return true;
  return assignees.roles.includes("command_operator");
}

async function resolveAssigneeUsers(
  prisma: PrismaClient,
  assignees: TriageShiftAssignees
): Promise<TriageShiftAssigneeUser[]> {
  const ids = assignees.userIds;
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<
    Array<{ id: string; name: string | null; email: string | null; role: string | null }>
  >`
    SELECT id, name, email, role
    FROM "User"
    WHERE id IN (${Prisma.join(ids)})
    ORDER BY name ASC NULLS LAST
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role ?? "driver",
  }));
}

async function resolveAssigneeOperators(
  prisma: PrismaClient,
  assignees: TriageShiftAssignees
): Promise<TriageShiftAssigneeOperator[]> {
  const ids = assignees.operatorIds;
  if (ids.length === 0) return [];
  const rows = await prisma.commandOperator.findMany({
    where: { isActive: true, operatorId: { in: ids } },
    orderBy: { fullName: "asc" },
    select: { operatorId: true, fullName: true, username: true, role: true },
  });
  return rows.map((r) => ({
    operatorId: r.operatorId,
    fullName: r.fullName,
    username: r.username,
    role: r.role,
  }));
}

async function listActiveCommandOperators(
  prisma: PrismaClient
): Promise<TriageShiftAssigneeOperator[]> {
  const rows = await prisma.commandOperator.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    select: { operatorId: true, fullName: true, username: true, role: true },
  });
  return rows.map((r) => ({
    operatorId: r.operatorId,
    fullName: r.fullName,
    username: r.username,
    role: r.role,
  }));
}

async function roleActiveCounts(
  prisma: PrismaClient,
  roles: TriageShiftRole[]
): Promise<Partial<Record<TriageShiftRole, number>>> {
  const out: Partial<Record<TriageShiftRole, number>> = {};
  for (const role of roles) {
    if (role === "command_operator") {
      out.command_operator = await prisma.commandOperator.count({ where: { isActive: true } });
    } else {
      const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "User"
        WHERE role = ${role} AND "disabledAt" IS NULL
      `;
      out[role] = Number(rows[0]?.count ?? 0);
    }
  }
  return out;
}

async function toPublicShift(prisma: PrismaClient, row: TriageShiftRow): Promise<TriageShiftPublic> {
  const assignees = row.assignees;
  const [assigneeUsers, assigneeOperators, counts] = await Promise.all([
    resolveAssigneeUsers(prisma, assignees),
    resolveAssigneeOperators(prisma, assignees),
    roleActiveCounts(prisma, assignees.roles),
  ]);

  return {
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    startsAtLabel: formatPerthDateTime(row.startsAt),
    endsAtLabel: formatPerthDateTime(row.endsAt),
    assignees,
    assigneeUsers,
    assigneeOperators,
    roleLabels: assignees.roles.map((role) => ({
      role,
      label: ROLE_LABELS[role],
      activeCount: counts[role] ?? null,
    })),
    handoffNote: row.handoffNote,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowFromPrisma(row: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  assignees: Prisma.JsonValue;
  handoffNote: string | null;
  updatedAt: Date;
}): TriageShiftRow {
  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    assignees: parseAssignees(row.assignees),
    handoffNote: row.handoffNote,
    updatedAt: row.updatedAt,
  };
}

async function getCurrentTriageShift(prisma: PrismaClient): Promise<TriageShiftRow | null> {
  const now = new Date();
  const row = await prisma.triageShift.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
  return row ? rowFromPrisma(row) : null;
}

async function getNextTriageShift(prisma: PrismaClient): Promise<TriageShiftRow | null> {
  const now = new Date();
  const row = await prisma.triageShift.findFirst({
    where: { startsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
  });
  return row ? rowFromPrisma(row) : null;
}

export async function getTriageShiftSnapshot(prisma: PrismaClient): Promise<TriageShiftSnapshot> {
  const [currentRow, nextRow] = await Promise.all([
    getCurrentTriageShift(prisma),
    getNextTriageShift(prisma),
  ]);
  return {
    current: currentRow ? await toPublicShift(prisma, currentRow) : null,
    next: nextRow ? await toPublicShift(prisma, nextRow) : null,
    timezone: TRIAGE_SHIFT_TIMEZONE,
  };
}

export function buildOperatorOnShift(
  snapshot: TriageShiftSnapshot,
  operatorId: string
): { onShift: boolean; operatorId: string } {
  const shift = snapshot.current;
  if (!shift) {
    return { onShift: false, operatorId };
  }
  return {
    operatorId,
    onShift: isOperatorOnShift(shift.assignees, { operatorId }),
  };
}

/** Server-side gate — mirrors manager assertManagerOnShift in app-next. */
export async function assertOperatorOnShift(
  prisma: PrismaClient,
  operatorId: string
): Promise<void> {
  const snapshot = await getTriageShiftSnapshot(prisma);
  const viewer = buildOperatorOnShift(snapshot, operatorId);
  if (!viewer.onShift) {
    throw new CommandApiError("ERR_NOT_ON_SHIFT", "You are not on triage shift.", 403);
  }
}

/** One-line summary for shift banners (both UIs). */
export function formatShiftAssigneeSummary(shift: TriageShiftPublic): string {
  const parts: string[] = [];
  for (const r of shift.roleLabels) {
    parts.push(r.activeCount != null ? `${r.label} (${r.activeCount} active)` : r.label);
  }
  for (const u of shift.assigneeUsers) {
    parts.push(u.name?.trim() || u.email || "Manager");
  }
  for (const o of shift.assigneeOperators) {
    parts.push(o.fullName);
  }
  return parts.join(" · ") || "—";
}

export { listActiveCommandOperators };
