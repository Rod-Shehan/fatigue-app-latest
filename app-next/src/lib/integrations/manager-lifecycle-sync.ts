/**
 * Manager → Command lifecycle sync (shared queue §3.5).
 */

import type { PrismaClient } from "@prisma/client";
import type { CameraAlertTriageDecision } from "@/lib/integrations/camera-alert-triage";

async function listPendingBridgedLifecycleIds(
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

export type ManagerLifecycleSyncResult = {
  lifecycleId: string | null;
  lifecycleStatus: string | null;
  updatedCount: number;
};

async function closeDismissedLifecycle(
  prisma: PrismaClient,
  lifecycleId: string,
  auditNote: string | null
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      event_status = 'VERIFIED_FALSE_POSITIVE',
      operator_notes = ${auditNote},
      triaged_at = NOW(),
      closed_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
  `;
}

async function closeAuthorizedLifecycle(
  prisma: PrismaClient,
  lifecycleId: string,
  auditNote: string | null
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      event_status = 'VERIFIED_TRUE_FATIGUE',
      operator_notes = ${auditNote},
      triaged_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
  `;

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'INTERVENTION_SENT', intervention_triggered_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'VERIFIED_TRUE_FATIGUE'
  `;

  await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'CLOSED', closed_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'INTERVENTION_SENT'
  `;
}

/** Close Command lifecycle row(s) after manager triage. */
export async function syncCommandLifecycleFromManagerTriage(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    decision: CameraAlertTriageDecision;
    note?: string | null;
  }
): Promise<ManagerLifecycleSyncResult> {
  const lifecycleIds = await listPendingBridgedLifecycleIds(prisma, args.ingestEventId);
  if (lifecycleIds.length === 0) {
    return { lifecycleId: null, lifecycleStatus: null, updatedCount: 0 };
  }

  const auditNote = args.note?.trim() || null;
  let updatedCount = 0;

  for (const lifecycleId of lifecycleIds) {
    if (args.decision === "dismissed") {
      await closeDismissedLifecycle(prisma, lifecycleId, auditNote);
      updatedCount += 1;
    } else {
      await closeAuthorizedLifecycle(prisma, lifecycleId, auditNote);
      updatedCount += 1;
    }
  }

  const lifecycleStatus = args.decision === "dismissed" ? "VERIFIED_FALSE_POSITIVE" : "CLOSED";
  return {
    lifecycleId: lifecycleIds[0] ?? null,
    lifecycleStatus,
    updatedCount,
  };
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
    SELECT DISTINCT ON (t."ingestEventId")
      t."ingestEventId" AS ingest_event_id,
      t.decision,
      t.note
    FROM "CameraAlertTriage" t
    INNER JOIN edge_fatigue_events e ON (
      t."ingestEventId" = e.source_ingest_id
      OR (
        t."vendorEventId" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "AutonomiseWebhookIngest" i
          WHERE i.id = e.source_ingest_id
            AND i."vendorEventId" = t."vendorEventId"
        )
      )
    )
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND t.decision IN ('authorized', 'dismissed')
    ORDER BY t."ingestEventId", t."decidedAt" DESC
  `;

  let updated = 0;
  for (const row of rows) {
    const result = await syncCommandLifecycleFromManagerTriage(prisma, {
      ingestEventId: row.ingest_event_id,
      decision: row.decision as CameraAlertTriageDecision,
      note: row.note,
    });
    updated += result.updatedCount;
  }
  return updated;
}
