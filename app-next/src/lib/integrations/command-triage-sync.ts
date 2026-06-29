/**
 * Mirror Command lifecycle triage into manager Live alerts (shared queue §3.5).
 * Ingest → Command bridge is one-way; this closes the loop for triage status.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import type { CameraAlertTriageRecord } from "@/lib/integrations/camera-alert-triage";

export type CameraAlertTriageDecision = "authorized" | "dismissed";

const PENDING_LIFECYCLE_STATUS = "PENDING_TRIAGE";

export function lifecycleStatusToManagerDecision(
  eventStatus: string
): CameraAlertTriageDecision | null {
  if (eventStatus === PENDING_LIFECYCLE_STATUS) return null;
  if (eventStatus === "VERIFIED_FALSE_POSITIVE") return "dismissed";
  return "authorized";
}

export function commandOperatorDisplayName(args: {
  fullName: string | null;
  email: string | null;
}): string {
  if (args.fullName?.trim()) return `${args.fullName.trim()} (Command)`;
  if (args.email?.trim()) return args.email.trim();
  return "Command operator";
}

export function mergeTriageByIngestId(
  managerTriage: Map<string, CameraAlertTriageRecord>,
  commandTriage: Map<string, CameraAlertTriageRecord>
): Map<string, CameraAlertTriageRecord> {
  const merged = new Map(managerTriage);
  for (const [ingestId, record] of commandTriage) {
    if (!merged.has(ingestId)) merged.set(ingestId, record);
  }
  return merged;
}

type LifecycleTriageRow = {
  ingest_event_id: string;
  event_status: string;
  operator_notes: string | null;
  triaged_at: Date | null;
  operator_id: string | null;
  full_name: string | null;
  email: string | null;
};

export async function loadCommandLifecycleTriageByIngestIds(
  prisma: PrismaClient,
  ingestEventIds: string[]
): Promise<Map<string, CameraAlertTriageRecord>> {
  if (ingestEventIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<LifecycleTriageRow[]>`
    SELECT
      e.source_ingest_id AS ingest_event_id,
      l.event_status,
      l.operator_notes,
      l.triaged_at,
      l.operator_id::text AS operator_id,
      co.full_name,
      co.email
    FROM edge_fatigue_events e
    INNER JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
    LEFT JOIN command_operators co ON co.operator_id = l.operator_id
    WHERE e.source_ingest_id IN (${Prisma.join(ingestEventIds)})
  `;

  const map = new Map<string, CameraAlertTriageRecord>();
  for (const row of rows) {
    const decision = lifecycleStatusToManagerDecision(row.event_status);
    if (!decision) continue;

    map.set(row.ingest_event_id, {
      ingestEventId: row.ingest_event_id,
      vendorEventId: null,
      decision,
      note: row.operator_notes,
      decidedByUserId: row.operator_id ? `command:${row.operator_id}` : "command:unknown",
      decidedByEmail: commandOperatorDisplayName({
        fullName: row.full_name,
        email: row.email,
      }),
      decidedAt: row.triaged_at ?? new Date(),
    });
  }
  return map;
}
