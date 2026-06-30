/**
 * Incident claim mutex — shared lifecycle queue (§3.5 Phase 2).
 */

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { buildViewerOnShift, getTriageShiftSnapshot } from "@/lib/triage-shift";

export type ClaimActorType = "manager" | "command_operator";

export type IncidentClaimView = {
  lifecycleId: string;
  claimedByActorType: ClaimActorType | null;
  claimedByUserId: string | null;
  claimedByOperatorId: string | null;
  claimedByLabel: string | null;
  claimedAt: string | null;
};

export class IncidentClaimError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NOT_FOUND"
      | "NOT_ON_SHIFT"
      | "ALREADY_CLAIMED"
      | "NOT_CLAIMED_BY_YOU"
      | "NOT_PENDING"
  ) {
    super(message);
    this.name = "IncidentClaimError";
  }
}

type ClaimRow = {
  lifecycle_id: string;
  event_status: string;
  operator_id: string | null;
  claimed_by_user_id: string | null;
  claimed_at: Date | null;
  claimed_by_actor_type: string | null;
  operator_name: string | null;
  user_name: string | null;
  user_email: string | null;
};

function labelFromRow(row: ClaimRow): string | null {
  if (row.claimed_by_actor_type === "command_operator" && row.operator_name) {
    return row.operator_name;
  }
  if (row.claimed_by_actor_type === "manager") {
    return row.user_name?.trim() || row.user_email || "Manager";
  }
  return null;
}

export function mapClaimRow(row: ClaimRow): IncidentClaimView {
  const actorType =
    row.claimed_by_actor_type === "manager" || row.claimed_by_actor_type === "command_operator"
      ? row.claimed_by_actor_type
      : row.operator_id
        ? "command_operator"
        : row.claimed_by_user_id
          ? "manager"
          : null;

  return {
    lifecycleId: row.lifecycle_id,
    claimedByActorType: actorType,
    claimedByUserId: row.claimed_by_user_id,
    claimedByOperatorId: row.operator_id,
    claimedByLabel: labelFromRow(row),
    claimedAt: row.claimed_at?.toISOString() ?? null,
  };
}

export function isClaimHeldBy(
  claim: IncidentClaimView,
  actor: { type: "manager"; userId: string } | { type: "command_operator"; operatorId: string }
): boolean {
  if (!claim.claimedByActorType) return false;
  if (actor.type === "manager") {
    return claim.claimedByActorType === "manager" && claim.claimedByUserId === actor.userId;
  }
  return claim.claimedByActorType === "command_operator" && claim.claimedByOperatorId === actor.operatorId;
}

export function isClaimedByOther(
  claim: IncidentClaimView,
  actor: { type: "manager"; userId: string } | { type: "command_operator"; operatorId: string }
): boolean {
  if (!claim.claimedByActorType) return false;
  return !isClaimHeldBy(claim, actor);
}

export async function assertManagerOnShift(
  prisma: PrismaClient,
  userId: string,
  userRole?: string | null
): Promise<void> {
  const snapshot = await getTriageShiftSnapshot(prisma);
  const viewer = buildViewerOnShift(snapshot, {
    viewer: "manager",
    userId,
    userRole: userRole ?? undefined,
    onShift: false,
  });
  if (!viewer.onShift) {
    throw new IncidentClaimError("You are not on triage shift.", "NOT_ON_SHIFT");
  }
}

async function fetchClaimRow(prisma: PrismaClient, lifecycleId: string): Promise<ClaimRow | null> {
  const rows = await prisma.$queryRaw<ClaimRow[]>`
    SELECT
      l.lifecycle_id::text AS lifecycle_id,
      l.event_status,
      l.operator_id::text AS operator_id,
      l.claimed_by_user_id,
      l.claimed_at,
      l.claimed_by_actor_type,
      co.full_name AS operator_name,
      u.name AS user_name,
      u.email AS user_email
    FROM fatigue_incident_lifecycle l
    LEFT JOIN command_operators co ON co.operator_id = l.operator_id
    LEFT JOIN "User" u ON u.id = l.claimed_by_user_id
    WHERE l.lifecycle_id = ${lifecycleId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function loadIncidentClaimsByLifecycleIds(
  prisma: PrismaClient,
  lifecycleIds: string[]
): Promise<Map<string, IncidentClaimView>> {
  if (lifecycleIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<ClaimRow[]>`
    SELECT
      l.lifecycle_id::text AS lifecycle_id,
      l.event_status,
      l.operator_id::text AS operator_id,
      l.claimed_by_user_id,
      l.claimed_at,
      l.claimed_by_actor_type,
      co.full_name AS operator_name,
      u.name AS user_name,
      u.email AS user_email
    FROM fatigue_incident_lifecycle l
    LEFT JOIN command_operators co ON co.operator_id = l.operator_id
    LEFT JOIN "User" u ON u.id = l.claimed_by_user_id
    WHERE l.lifecycle_id = ANY(${lifecycleIds}::uuid[])
  `;
  return new Map(rows.map((row) => [row.lifecycle_id, mapClaimRow(row)]));
}

async function logClaimAudit(
  prisma: PrismaClient,
  args: {
    lifecycleId: string;
    actorId: string;
    actorType: "FLEET_MANAGER" | "OPERATOR";
    action: "claimed" | "claim_released";
    snapshot: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO lifecycle_transition_log (
      log_id,
      lifecycle_id,
      from_status,
      to_status,
      triggered_by_id,
      actor_type,
      transition_payload_snapshot
    ) VALUES (
      ${randomUUID()}::uuid,
      ${args.lifecycleId}::uuid,
      'PENDING_TRIAGE',
      'PENDING_TRIAGE',
      ${args.actorId},
      ${args.actorType},
      ${JSON.stringify({ ...args.snapshot, action: args.action })}::jsonb
    )
  `;
}

export async function claimIncidentForManager(
  prisma: PrismaClient,
  args: {
    lifecycleId: string;
    userId: string;
    userRole?: string | null;
    userLabel: string;
  }
): Promise<IncidentClaimView> {
  await assertManagerOnShift(prisma, args.userId, args.userRole);

  const updated = await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      claimed_by_user_id = ${args.userId},
      claimed_at = NOW(),
      claimed_by_actor_type = 'manager',
      operator_id = NULL
    WHERE lifecycle_id = ${args.lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
      AND operator_id IS NULL
      AND claimed_by_user_id IS NULL
  `;

  if (Number(updated) === 0) {
    const row = await fetchClaimRow(prisma, args.lifecycleId);
    if (!row) throw new IncidentClaimError("Incident not found.", "NOT_FOUND");
    if (row.event_status !== "PENDING_TRIAGE") {
      throw new IncidentClaimError("Incident is no longer awaiting triage.", "NOT_PENDING");
    }
    throw new IncidentClaimError(
      "This safety event has already been claimed by another desk.",
      "ALREADY_CLAIMED"
    );
  }

  await logClaimAudit(prisma, {
    lifecycleId: args.lifecycleId,
    actorId: args.userId,
    actorType: "FLEET_MANAGER",
    action: "claimed",
    snapshot: { actor_label: args.userLabel, claimed_by_actor_type: "manager" },
  });

  const fresh = await fetchClaimRow(prisma, args.lifecycleId);
  if (!fresh) throw new IncidentClaimError("Incident not found.", "NOT_FOUND");
  return mapClaimRow(fresh);
}

export async function releaseIncidentClaimForManager(
  prisma: PrismaClient,
  args: { lifecycleId: string; userId: string }
): Promise<boolean> {
  const updated = await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      claimed_by_user_id = NULL,
      claimed_at = NULL,
      claimed_by_actor_type = NULL
    WHERE lifecycle_id = ${args.lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
      AND claimed_by_user_id = ${args.userId}
      AND claimed_by_actor_type = 'manager'
  `;

  if (Number(updated) === 0) return false;

  await logClaimAudit(prisma, {
    lifecycleId: args.lifecycleId,
    actorId: args.userId,
    actorType: "FLEET_MANAGER",
    action: "claim_released",
    snapshot: { claimed_by_actor_type: "manager" },
  });

  return true;
}

export async function assertManagerHoldsClaim(
  prisma: PrismaClient,
  lifecycleId: string,
  userId: string
): Promise<void> {
  const row = await fetchClaimRow(prisma, lifecycleId);
  if (!row) throw new IncidentClaimError("Incident not found.", "NOT_FOUND");
  if (row.event_status !== "PENDING_TRIAGE") {
    throw new IncidentClaimError("Incident is no longer awaiting triage.", "NOT_PENDING");
  }
  const claim = mapClaimRow(row);
  if (!isClaimHeldBy(claim, { type: "manager", userId })) {
    if (claim.claimedByActorType) {
      throw new IncidentClaimError(
        `Claimed by ${claim.claimedByLabel ?? "another desk"}.`,
        "NOT_CLAIMED_BY_YOU"
      );
    }
    throw new IncidentClaimError("Claim this event before confirming or dismissing.", "NOT_CLAIMED_BY_YOU");
  }
}

export async function resolveLifecycleIdForIngest(
  prisma: PrismaClient,
  ingestEventId: string
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ lifecycle_id: string }>>`
    SELECT l.lifecycle_id::text AS lifecycle_id
    FROM edge_fatigue_events e
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE e.source_ingest_id = ${ingestEventId}
      AND l.event_status = 'PENDING_TRIAGE'
    ORDER BY l.detected_at DESC
    LIMIT 1
  `;
  return rows[0]?.lifecycle_id ?? null;
}
