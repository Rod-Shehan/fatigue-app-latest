/**
 * Fatigue incident lifecycle transitions — mirrors circadia-command transition-incident.ts.
 */

import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";

export const LIFECYCLE_STATUSES = [
  "PENDING_TRIAGE",
  "VERIFIED_FALSE_POSITIVE",
  "VERIFIED_TRUE_FATIGUE",
  "MANAGER_VALIDATION_PENDING",
  "INTERVENTION_SENT",
  "DRIVER_ACKNOWLEDGED",
  "DRIVER_DISPUTED",
  "CLOSED",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export type ActorType = "OPERATOR" | "FLEET_MANAGER" | "SYSTEM" | "DRIVER";

export type TransitionPayload = {
  lifecycleId: string;
  expectedCurrentStatus: LifecycleStatus;
  targetStatus: LifecycleStatus;
  actorId: string;
  actorType: ActorType;
  notes?: string;
  snapshot: Record<string, unknown>;
};

export class LifecycleTransitionError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "STATE_CONCURRENCY" = "STATE_CONCURRENCY"
  ) {
    super(message);
    this.name = "LifecycleTransitionError";
  }
}

export async function transitionIncidentState(
  prisma: PrismaClient,
  payload: TransitionPayload
): Promise<void> {
  const { lifecycleId, expectedCurrentStatus, targetStatus, notes } = payload;

  const updated = await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      event_status = ${targetStatus},
      operator_notes = COALESCE(${notes ?? null}, operator_notes),
      triaged_at = CASE
        WHEN ${targetStatus} IN ('VERIFIED_TRUE_FATIGUE', 'VERIFIED_FALSE_POSITIVE') THEN NOW()
        ELSE triaged_at
      END,
      intervention_triggered_at = CASE
        WHEN ${targetStatus} = 'INTERVENTION_SENT' THEN NOW()
        ELSE intervention_triggered_at
      END,
      driver_responded_at = CASE
        WHEN ${targetStatus} IN ('DRIVER_ACKNOWLEDGED', 'DRIVER_DISPUTED') THEN NOW()
        ELSE driver_responded_at
      END,
      closed_at = CASE
        WHEN ${targetStatus} IN ('VERIFIED_FALSE_POSITIVE', 'CLOSED') THEN NOW()
        ELSE closed_at
      END
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = ${expectedCurrentStatus}
  `;

  if (Number(updated) === 0) {
    const exists = await prisma.$queryRaw<Array<{ event_status: string }>>`
      SELECT event_status
      FROM fatigue_incident_lifecycle
      WHERE lifecycle_id = ${lifecycleId}::uuid
      LIMIT 1
    `;
    if (exists.length === 0) {
      throw new LifecycleTransitionError("Incident lifecycle not found.", "NOT_FOUND");
    }
    throw new LifecycleTransitionError(
      "Incident state changed before this action could apply.",
      "STATE_CONCURRENCY"
    );
  }

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
      ${lifecycleId}::uuid,
      ${expectedCurrentStatus},
      ${targetStatus},
      ${payload.actorId},
      ${payload.actorType},
      ${JSON.stringify(payload.snapshot)}::jsonb
    )
  `;
}

export async function listPendingLifecycleIdsForIngest(
  prisma: PrismaClient,
  ingestEventId: string
): Promise<string[]> {
  const ingest = await prisma.autonomiseWebhookIngest.findUnique({
    where: { id: ingestEventId },
    select: { vendorEventId: true },
  });
  const vendorEventId = ingest?.vendorEventId ?? null;

  if (vendorEventId) {
    const rows = await prisma.$queryRaw<Array<{ lifecycle_id: string }>>`
      SELECT l.lifecycle_id::text AS lifecycle_id
      FROM edge_fatigue_events e
      INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
      LEFT JOIN "AutonomiseWebhookIngest" i ON i.id = e.source_ingest_id
      WHERE l.event_status = 'PENDING_TRIAGE'
        AND (
          e.source_ingest_id = ${ingestEventId}
          OR i."vendorEventId" = ${vendorEventId}
        )
    `;
    return rows.map((row) => row.lifecycle_id);
  }

  const rows = await prisma.$queryRaw<Array<{ lifecycle_id: string }>>`
    SELECT l.lifecycle_id::text AS lifecycle_id
    FROM edge_fatigue_events e
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND e.source_ingest_id = ${ingestEventId}
  `;
  return rows.map((row) => row.lifecycle_id);
}

export type ManagerLifecycleCompleteResult = {
  lifecycleId: string | null;
  lifecycleStatus: LifecycleStatus | null;
  updatedCount: number;
};

/** Dismiss from pending — mirrors Command F1 / VERIFIED_FALSE_POSITIVE. */
export async function applyManagerDismissFromPending(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    actorId: string;
    note?: string | null;
    idempotencyKey?: string;
  }
): Promise<ManagerLifecycleCompleteResult> {
  const lifecycleIds = await listPendingLifecycleIdsForIngest(prisma, args.ingestEventId);
  if (lifecycleIds.length === 0) {
    return { lifecycleId: null, lifecycleStatus: null, updatedCount: 0 };
  }

  const auditNote = args.note?.trim() || "Dismissed as false positive";
  let updatedCount = 0;

  for (const lifecycleId of lifecycleIds) {
    await transitionIncidentState(prisma, {
      lifecycleId,
      expectedCurrentStatus: "PENDING_TRIAGE",
      targetStatus: "VERIFIED_FALSE_POSITIVE",
      actorId: args.actorId,
      actorType: "FLEET_MANAGER",
      notes: auditNote,
      snapshot: {
        idempotency_key: args.idempotencyKey ?? `manager_dismiss_${lifecycleId}`,
        action: "VERIFIED_FALSE_POSITIVE",
        source: "manager_alerts",
      },
    });
    updatedCount += 1;
  }

  return {
    lifecycleId: lifecycleIds[0] ?? null,
    lifecycleStatus: "VERIFIED_FALSE_POSITIVE",
    updatedCount,
  };
}

/**
 * Verified fatigue + resolution — mirrors Command completeOperatorResolution.
 * Fleet manager on manager app completes the path (no MANAGER_VALIDATION_PENDING hold).
 */
export async function applyManagerVerifiedResolutionFromPending(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    actorId: string;
    auditNote: string;
    resolutionActionType: string;
    idempotencyKey?: string;
  }
): Promise<ManagerLifecycleCompleteResult> {
  const lifecycleIds = await listPendingLifecycleIdsForIngest(prisma, args.ingestEventId);
  if (lifecycleIds.length === 0) {
    return { lifecycleId: null, lifecycleStatus: null, updatedCount: 0 };
  }

  let updatedCount = 0;
  let finalStatus: LifecycleStatus = "CLOSED";

  for (const lifecycleId of lifecycleIds) {
    const idempotencyKey = args.idempotencyKey ?? `manager_resolve_${lifecycleId}`;

    await transitionIncidentState(prisma, {
      lifecycleId,
      expectedCurrentStatus: "PENDING_TRIAGE",
      targetStatus: "VERIFIED_TRUE_FATIGUE",
      actorId: args.actorId,
      actorType: "FLEET_MANAGER",
      notes: args.auditNote,
      snapshot: {
        idempotency_key: idempotencyKey,
        action: "VERIFIED_TRUE_FATIGUE",
        resolution_action: args.resolutionActionType,
        source: "manager_alerts",
      },
    });

    await transitionIncidentState(prisma, {
      lifecycleId,
      expectedCurrentStatus: "VERIFIED_TRUE_FATIGUE",
      targetStatus: "INTERVENTION_SENT",
      actorId: "SYSTEM",
      actorType: "SYSTEM",
      snapshot: { reason: "manager_resolution_recorded" },
    });

    await transitionIncidentState(prisma, {
      lifecycleId,
      expectedCurrentStatus: "INTERVENTION_SENT",
      targetStatus: "CLOSED",
      actorId: args.actorId,
      actorType: "FLEET_MANAGER",
      notes: args.auditNote,
      snapshot: {
        reason: "resolution_closed",
        resolution_action: args.resolutionActionType,
        source: "manager_alerts",
      },
    });

    updatedCount += 1;
    finalStatus = "CLOSED";
  }

  return {
    lifecycleId: lifecycleIds[0] ?? null,
    lifecycleStatus: finalStatus,
    updatedCount,
  };
}
