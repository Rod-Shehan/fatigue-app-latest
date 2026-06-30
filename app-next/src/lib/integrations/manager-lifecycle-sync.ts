/**
 * Manager → Command lifecycle sync (shared queue §3.5).
 * Command→manager write-through lives in circadia-command sync-manager-triage.
 */

import type { PrismaClient } from "@prisma/client";
import type { CameraAlertTriageDecision } from "@/lib/integrations/camera-alert-triage";

type BridgedLifecycle = {
  lifecycleId: string;
  tenantIdUuid: string;
};

async function lookupPendingBridgedLifecycle(
  prisma: PrismaClient,
  ingestEventId: string
): Promise<BridgedLifecycle | null> {
  const rows = await prisma.$queryRaw<
    Array<{ lifecycle_id: string; tenant_id_uuid: string; event_status: string }>
  >`
    SELECT l.lifecycle_id::text AS lifecycle_id, l.tenant_id_uuid::text AS tenant_id_uuid, l.event_status
    FROM edge_fatigue_events e
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE e.source_ingest_id = ${ingestEventId}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.event_status !== "PENDING_TRIAGE") return null;
  return { lifecycleId: row.lifecycle_id, tenantIdUuid: row.tenant_id_uuid };
}

export type ManagerLifecycleSyncResult = {
  lifecycleId: string | null;
  lifecycleStatus: string | null;
};

/** Close or dismiss the Command lifecycle row after manager triage. */
export async function syncCommandLifecycleFromManagerTriage(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    decision: CameraAlertTriageDecision;
    note?: string | null;
  }
): Promise<ManagerLifecycleSyncResult> {
  const bridged = await lookupPendingBridgedLifecycle(prisma, args.ingestEventId);
  if (!bridged) {
    return { lifecycleId: null, lifecycleStatus: null };
  }

  const auditNote = args.note?.trim() || null;

  if (args.decision === "dismissed") {
    await prisma.$executeRaw`
      UPDATE fatigue_incident_lifecycle
      SET
        event_status = 'VERIFIED_FALSE_POSITIVE',
        operator_notes = ${auditNote},
        triaged_at = NOW(),
        closed_at = NOW()
      WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
        AND event_status = 'PENDING_TRIAGE'
    `;
    return { lifecycleId: bridged.lifecycleId, lifecycleStatus: "VERIFIED_FALSE_POSITIVE" };
  }

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      event_status = 'VERIFIED_TRUE_FATIGUE',
      operator_notes = ${auditNote},
      triaged_at = NOW()
    WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
  `;

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'INTERVENTION_SENT', intervention_triggered_at = NOW()
    WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
      AND event_status = 'VERIFIED_TRUE_FATIGUE'
  `;

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'CLOSED', closed_at = NOW()
    WHERE lifecycle_id = ${bridged.lifecycleId}::uuid
      AND event_status = 'INTERVENTION_SENT'
  `;

  return { lifecycleId: bridged.lifecycleId, lifecycleStatus: "CLOSED" };
}

/** Backfill lifecycle rows still pending after manager triage (pre-sync era). */
export async function reconcileStalePendingLifecycleFromManagerTriage(
  prisma: PrismaClient
): Promise<number> {
  const rows = await prisma.$queryRaw<
    Array<{
      ingest_event_id: string;
      decision: string;
      note: string | null;
    }>
  >`
    SELECT
      t."ingestEventId" AS ingest_event_id,
      t.decision,
      t.note
    FROM "CameraAlertTriage" t
    INNER JOIN edge_fatigue_events e ON e.source_ingest_id = t."ingestEventId"
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND t.decision IN ('authorized', 'dismissed')
  `;

  let updated = 0;
  for (const row of rows) {
    const result = await syncCommandLifecycleFromManagerTriage(prisma, {
      ingestEventId: row.ingest_event_id,
      decision: row.decision as CameraAlertTriageDecision,
      note: row.note,
    });
    if (result.lifecycleId) updated += 1;
  }
  return updated;
}
