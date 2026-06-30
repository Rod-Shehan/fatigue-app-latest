/**
 * Manager triage ↔ Command queue alignment.
 * Keep reconcile SQL in sync with app-next manager-lifecycle-sync.ts
 */

import type { TxClient } from "@/lib/privileged-db";

const TRIAGE_MATCH_SQL = `
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
`;

export async function reconcileStalePendingLifecycleFromManagerTriage(
  tx: TxClient
): Promise<number> {
  const dismissed = await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle l
    SET
      event_status = 'VERIFIED_FALSE_POSITIVE',
      operator_notes = matched.note,
      triaged_at = NOW(),
      closed_at = NOW()
    FROM edge_fatigue_events e
    INNER JOIN LATERAL (
      SELECT t.note
      FROM "CameraAlertTriage" t
      WHERE t.decision = 'dismissed'
        AND (
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
      ORDER BY t."decidedAt" DESC
      LIMIT 1
    ) matched ON TRUE
    WHERE l.event_id = e.event_id
      AND l.event_status = 'PENDING_TRIAGE'
  `;

  const authorizedStep1 = await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle l
    SET
      event_status = 'VERIFIED_TRUE_FATIGUE',
      operator_notes = matched.note,
      triaged_at = NOW()
    FROM edge_fatigue_events e
    INNER JOIN LATERAL (
      SELECT t.note
      FROM "CameraAlertTriage" t
      WHERE t.decision = 'authorized'
        AND (
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
      ORDER BY t."decidedAt" DESC
      LIMIT 1
    ) matched ON TRUE
    WHERE l.event_id = e.event_id
      AND l.event_status = 'PENDING_TRIAGE'
  `;

  await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle l
    SET event_status = 'INTERVENTION_SENT', intervention_triggered_at = NOW()
    FROM edge_fatigue_events e
    WHERE l.event_id = e.event_id
      AND l.event_status = 'VERIFIED_TRUE_FATIGUE'
      AND EXISTS (
        SELECT 1
        FROM "CameraAlertTriage" t
        WHERE t.decision = 'authorized'
          AND (
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
      )
  `;

  await tx.$executeRaw`
    UPDATE fatigue_incident_lifecycle l
    SET event_status = 'CLOSED', closed_at = NOW()
    FROM edge_fatigue_events e
    WHERE l.event_id = e.event_id
      AND l.event_status = 'INTERVENTION_SENT'
      AND EXISTS (
        SELECT 1
        FROM "CameraAlertTriage" t
        WHERE t.decision = 'authorized'
          AND (
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
      )
  `;

  return Number(dismissed) + Number(authorizedStep1);
}

export async function isEdgeManagerTriaged(
  tx: TxClient,
  sourceIngestId: string | null | undefined
): Promise<boolean> {
  if (!sourceIngestId) return false;
  const rows = await tx.$queryRaw<Array<{ triaged: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM "CameraAlertTriage" t
      WHERE t."ingestEventId" = ${sourceIngestId}
         OR (
           t."vendorEventId" IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM "AutonomiseWebhookIngest" i
             WHERE i.id = ${sourceIngestId}
               AND i."vendorEventId" = t."vendorEventId"
           )
         )
    ) AS triaged
  `;
  return rows[0]?.triaged === true;
}

/** Pending lifecycle ids that should not appear on Command (manager already decided). */
export async function listManagerTriagedPendingLifecycleIds(tx: TxClient): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ lifecycle_id: string }>>`
    SELECT l.lifecycle_id::text AS lifecycle_id
    FROM fatigue_incident_lifecycle l
    INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
    WHERE l.event_status = 'PENDING_TRIAGE'
      AND EXISTS (
        SELECT 1
        FROM "CameraAlertTriage" t
        WHERE t."ingestEventId" = e.source_ingest_id
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
  `;
  return rows.map((row) => row.lifecycle_id);
}

// Reference for cross-repo parity (not executed).
void TRIAGE_MATCH_SQL;
