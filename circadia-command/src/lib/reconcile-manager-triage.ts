/**
 * Backfill Command queue rows already triaged on manager Live alerts.
 * Keep in sync with app-next/src/lib/integrations/manager-lifecycle-sync.ts
 */

import type { TxClient } from "@/lib/privileged-db";

type StaleTriageRow = {
  ingest_event_id: string;
  decision: string;
  note: string | null;
};

async function listStalePendingFromManagerTriage(tx: TxClient): Promise<StaleTriageRow[]> {
  return tx.$queryRaw<StaleTriageRow[]>`
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
}

async function syncOneStaleRow(tx: TxClient, row: StaleTriageRow): Promise<boolean> {
  const lifecycleRows = await tx.$queryRaw<Array<{ lifecycle_id: string }>>`
    SELECT l.lifecycle_id::text AS lifecycle_id
    FROM edge_fatigue_events e
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    WHERE e.source_ingest_id = ${row.ingest_event_id}
      AND l.event_status = 'PENDING_TRIAGE'
    LIMIT 1
  `;
  const lifecycleId = lifecycleRows[0]?.lifecycle_id;
  if (!lifecycleId) return false;

  const note = row.note?.trim() || null;

  if (row.decision === "dismissed") {
    await tx.$executeRaw`
      UPDATE fatigue_incident_lifecycle
      SET
        event_status = 'VERIFIED_FALSE_POSITIVE',
        operator_notes = ${note},
        triaged_at = NOW(),
        closed_at = NOW()
      WHERE lifecycle_id = ${lifecycleId}::uuid
        AND event_status = 'PENDING_TRIAGE'
    `;
    return true;
  }

  await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET
      event_status = 'VERIFIED_TRUE_FATIGUE',
      operator_notes = ${note},
      triaged_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'PENDING_TRIAGE'
  `;

  await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'INTERVENTION_SENT', intervention_triggered_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'VERIFIED_TRUE_FATIGUE'
  `;

  await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle
    SET event_status = 'CLOSED', closed_at = NOW()
    WHERE lifecycle_id = ${lifecycleId}::uuid
      AND event_status = 'INTERVENTION_SENT'
  `;

  return true;
}

export async function reconcileStalePendingLifecycleFromManagerTriage(
  tx: TxClient
): Promise<number> {
  const rows = await listStalePendingFromManagerTriage(tx);
  let updated = 0;
  for (const row of rows) {
    if (await syncOneStaleRow(tx, row)) updated += 1;
  }
  return updated;
}
