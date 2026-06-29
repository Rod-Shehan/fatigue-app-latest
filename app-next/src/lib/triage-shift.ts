/**
 * Triage shift — who is on desk for fatigue incident claim/confirm (§3.5).
 * Shared Neon table read by app-next and circadia-command.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeUserRole } from "@/lib/roles";

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
  updatedByUserId: string | null;
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

export type TriageShiftViewerContext = {
  viewer: "manager" | "command_operator";
  userId?: string;
  userRole?: string;
  operatorId?: string;
  onShift: boolean;
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
    ? [...new Set(o.userIds.filter((id): id is string => typeof id === "string" && id.trim()))]
    : [];
  const operatorIds = Array.isArray(o.operatorIds)
    ? [...new Set(o.operatorIds.filter((id): id is string => typeof id === "string" && id.trim()))]
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

export function normalizeAssigneesInput(input: TriageShiftAssignees): TriageShiftAssignees {
  return parseAssignees(input);
}

/** WA is fixed UTC+8 (no DST). */
export function perthLocalInputToUtc(localDatetime: string): Date {
  const m = localDatetime.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("Invalid Perth datetime — use YYYY-MM-DDTHH:mm");
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0));
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

export function toPerthDatetimeLocalValue(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRIAGE_SHIFT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function isUserOnShift(
  assignees: TriageShiftAssignees,
  args: { userId: string; userRole: string | null | undefined }
): boolean {
  if (assignees.userIds.includes(args.userId)) return true;
  const role = normalizeUserRole(args.userRole);
  if (assignees.roles.includes("manager") && role === "manager") return true;
  if (assignees.roles.includes("owner") && role === "owner") return true;
  return false;
}

export function isOperatorOnShift(
  assignees: TriageShiftAssignees,
  args: { operatorId: string }
): boolean {
  if (assignees.operatorIds.includes(args.operatorId)) return true;
  return assignees.roles.includes("command_operator");
}

export async function listActiveCommandOperators(
  prisma: PrismaClient
): Promise<TriageShiftAssigneeOperator[]> {
  const rows = await prisma.$queryRaw<
    Array<{ operator_id: string; full_name: string; username: string | null; role: string }>
  >`
    SELECT operator_id::text AS operator_id, full_name, username, role
    FROM command_operators
    WHERE is_active = true
    ORDER BY full_name ASC
  `;
  return rows.map((r) => ({
    operatorId: r.operator_id,
    fullName: r.full_name,
    username: r.username,
    role: r.role,
  }));
}

async function resolveAssigneeUsers(
  prisma: PrismaClient,
  assignees: TriageShiftAssignees
): Promise<TriageShiftAssigneeUser[]> {
  const ids = assignees.userIds;
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? "driver",
  }));
}

async function resolveAssigneeOperators(
  prisma: PrismaClient,
  assignees: TriageShiftAssignees
): Promise<TriageShiftAssigneeOperator[]> {
  const ids = assignees.operatorIds;
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<
    Array<{ operator_id: string; full_name: string; username: string | null; role: string }>
  >`
    SELECT operator_id::text AS operator_id, full_name, username, role
    FROM command_operators
    WHERE is_active = true AND operator_id::text IN (${Prisma.join(ids)})
    ORDER BY full_name ASC
  `;
  return rows.map((r) => ({
    operatorId: r.operator_id,
    fullName: r.full_name,
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
      const ops = await listActiveCommandOperators(prisma);
      out.command_operator = ops.length;
    } else {
      const count = await prisma.user.count({
        where: { role, disabledAt: null },
      });
      out[role] = count;
    }
  }
  return out;
}

export async function toPublicShift(
  prisma: PrismaClient,
  row: TriageShiftRow
): Promise<TriageShiftPublic> {
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
  updatedByUserId: string | null;
  updatedAt: Date;
}): TriageShiftRow {
  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    assignees: parseAssignees(row.assignees),
    handoffNote: row.handoffNote,
    updatedByUserId: row.updatedByUserId,
    updatedAt: row.updatedAt,
  };
}

export async function getCurrentTriageShift(prisma: PrismaClient): Promise<TriageShiftRow | null> {
  const now = new Date();
  const row = await prisma.triageShift.findFirst({
    where: { startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
  return row ? rowFromPrisma(row) : null;
}

export async function getNextTriageShift(prisma: PrismaClient): Promise<TriageShiftRow | null> {
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

export async function listUpcomingTriageShifts(
  prisma: PrismaClient,
  limit = 20
): Promise<TriageShiftPublic[]> {
  const now = new Date();
  const rows = await prisma.triageShift.findMany({
    where: { endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  return Promise.all(rows.map((r) => toPublicShift(prisma, rowFromPrisma(r))));
}

export type SaveTriageShiftInput = {
  startsAt: Date;
  endsAt: Date;
  assignees: TriageShiftAssignees;
  handoffNote?: string | null;
  updatedByUserId: string;
};

export function validateShiftWindow(startsAt: Date, endsAt: Date): string | null {
  if (!(startsAt instanceof Date) || !(endsAt instanceof Date)) return "Invalid dates";
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) return "Invalid dates";
  if (endsAt <= startsAt) return "End must be after start";
  return null;
}

function assigneesEmpty(a: TriageShiftAssignees): boolean {
  return a.userIds.length === 0 && a.operatorIds.length === 0 && a.roles.length === 0;
}

export function validateAssignees(assignees: TriageShiftAssignees): string | null {
  if (assigneesEmpty(assignees)) {
    return "Select at least one person or role on shift";
  }
  return null;
}

export async function createTriageShift(
  prisma: PrismaClient,
  input: SaveTriageShiftInput
): Promise<TriageShiftPublic> {
  const assignees = normalizeAssigneesInput(input.assignees);
  const windowErr = validateShiftWindow(input.startsAt, input.endsAt);
  if (windowErr) throw new Error(windowErr);
  const assigneeErr = validateAssignees(assignees);
  if (assigneeErr) throw new Error(assigneeErr);

  const row = await prisma.triageShift.create({
    data: {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      assignees,
      handoffNote: input.handoffNote?.trim() || null,
      updatedByUserId: input.updatedByUserId,
    },
  });
  return toPublicShift(prisma, rowFromPrisma(row));
}

export async function updateTriageShift(
  prisma: PrismaClient,
  id: string,
  input: SaveTriageShiftInput
): Promise<TriageShiftPublic> {
  const assignees = normalizeAssigneesInput(input.assignees);
  const windowErr = validateShiftWindow(input.startsAt, input.endsAt);
  if (windowErr) throw new Error(windowErr);
  const assigneeErr = validateAssignees(assignees);
  if (assigneeErr) throw new Error(assigneeErr);

  const row = await prisma.triageShift.update({
    where: { id },
    data: {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      assignees,
      handoffNote: input.handoffNote?.trim() || null,
      updatedByUserId: input.updatedByUserId,
    },
  });
  return toPublicShift(prisma, rowFromPrisma(row));
}

export async function deleteTriageShift(prisma: PrismaClient, id: string): Promise<void> {
  await prisma.triageShift.delete({ where: { id } });
}

export function buildViewerOnShift(
  snapshot: TriageShiftSnapshot,
  viewer: TriageShiftViewerContext
): TriageShiftViewerContext & { shift: TriageShiftPublic | null } {
  const shift = snapshot.current;
  if (!shift) {
    return { ...viewer, onShift: false, shift: null };
  }
  let onShift = false;
  if (viewer.viewer === "manager" && viewer.userId) {
    onShift = isUserOnShift(shift.assignees, {
      userId: viewer.userId,
      userRole: viewer.userRole,
    });
  } else if (viewer.viewer === "command_operator" && viewer.operatorId) {
    onShift = isOperatorOnShift(shift.assignees, { operatorId: viewer.operatorId });
  }
  return { ...viewer, onShift, shift };
}

/** One-line summary for shift banners (both UIs). */
export function formatShiftAssigneeSummary(shift: TriageShiftPublic): string {
  const parts: string[] = [];
  for (const r of shift.roleLabels) {
    parts.push(
      r.activeCount != null ? `${r.label} (${r.activeCount} active)` : r.label
    );
  }
  for (const u of shift.assigneeUsers) {
    parts.push(u.name?.trim() || u.email || "Manager");
  }
  for (const o of shift.assigneeOperators) {
    parts.push(o.fullName);
  }
  return parts.join(" · ") || "—";
}
