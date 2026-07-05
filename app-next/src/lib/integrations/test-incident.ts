import { randomInt } from "crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ingestAutonomiseWebhook } from "@/lib/integrations/autonomise-ingest";
import { runAutonomiseIngestFollowUp } from "@/lib/integrations/autonomise-ingest-followup";
import { getEnabledAlarmIdSet } from "@/lib/integrations/camera-alert-event-settings";
import { isCommandLifecycleBridgeEnabled } from "@/lib/integrations/command-lifecycle-bridge-config";
import { deleteCameraAlertIngestBatch } from "@/lib/integrations/camera-alert-ingest-delete";
import { countActiveTriagePending } from "@/lib/integrations/triage-active-queue";
import {
  getTestIncidentSampleClipUrl,
  TEST_INCIDENT_EVENT_ID_PREFIX,
  TEST_INCIDENT_REGO_PREFIX,
} from "@/lib/integrations/test-incident-config";

export const TEST_INCIDENT_KINDS = ["fatigue", "distraction"] as const;
export type TestIncidentKind = (typeof TEST_INCIDENT_KINDS)[number];

const ALARM_BY_KIND: Record<TestIncidentKind, string> = {
  fatigue: "VT3600AI_ALARM_DSM_Fatigue",
  distraction: "VT3600AI_ALARM_DSM_Distracted",
};

export function buildTestIncidentPayload(args: {
  kind: TestIncidentKind;
  eventId?: string;
  vehicleRegistration?: string;
  driverName?: string;
}): { eventId: string; payload: Record<string, unknown>; vehicleRegistration: string } {
  const eventId =
    args.eventId?.trim() ||
    `${TEST_INCIDENT_EVENT_ID_PREFIX}${Date.now()}-${randomInt(1000, 9999)}`;
  const vehicleRegistration =
    args.vehicleRegistration?.trim().toUpperCase() ||
    `${TEST_INCIDENT_REGO_PREFIX}${randomInt(100, 999)}`;
  const triggerTime = new Date().toISOString();

  const payload: Record<string, unknown> = {
    eventId,
    alarmId: ALARM_BY_KIND[args.kind],
    vehicleRegistration,
    triggerTime,
    driverName: args.driverName?.trim() || "Test Driver",
    source: "circadia-test-desk",
    mediaUrl: getTestIncidentSampleClipUrl(eventId),
  };

  return { eventId, payload, vehicleRegistration };
}

export type InjectTestIncidentResult = {
  ingestId: string;
  accepted: boolean;
  duplicate: boolean;
  rejectReason: string | null;
  eventId: string;
  vehicleRegistration: string;
  vendorAlarmId: string | null;
  lifecycleId: string | null;
  bridgeSkippedReason: string | null;
};

export async function injectTestIncident(
  prisma: PrismaClient,
  args: { kind: TestIncidentKind; vehicleRegistration?: string }
): Promise<InjectTestIncidentResult> {
  const { eventId, payload, vehicleRegistration } = buildTestIncidentPayload({
    kind: args.kind,
    vehicleRegistration: args.vehicleRegistration,
  });

  const enabledAlarmIds = await getEnabledAlarmIdSet(prisma);
  const result = await ingestAutonomiseWebhook(prisma, {
    kind: "event",
    payload,
    enabledAlarmIds,
  });

  if (result.accepted && result.id && !result.duplicate) {
    await runAutonomiseIngestFollowUp(prisma, {
      kind: "event",
      payload,
      result,
    });
  }

  let lifecycleId: string | null = null;
  let bridgeSkippedReason: string | null = null;

  if (result.accepted && result.id) {
    const row = await prisma.$queryRaw<Array<{ lifecycle_id: string }>>`
      SELECT l.lifecycle_id::text AS lifecycle_id
      FROM fatigue_incident_lifecycle l
      INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
      WHERE e.source_ingest_id = ${result.id}
      LIMIT 1
    `;
    lifecycleId = row[0]?.lifecycle_id ?? null;
    if (!lifecycleId && !result.duplicate) {
      bridgeSkippedReason = "lifecycle_not_created";
    }
  }

  return {
    ingestId: result.id,
    accepted: result.accepted,
    duplicate: result.duplicate,
    rejectReason: result.rejectReason,
    eventId,
    vehicleRegistration,
    vendorAlarmId: result.vendorAlarmId,
    lifecycleId,
    bridgeSkippedReason,
  };
}

export type TestDeskStatus = {
  enabled: boolean;
  bridgeEnabled: boolean;
  pendingTriageCount: number;
  pendingTestIngestCount: number;
  pendingTestLifecycleCount: number;
};

export async function getTestDeskStatus(prisma: PrismaClient): Promise<TestDeskStatus> {
  const [pendingTriageCount, testIngestRows, testLifecycleRows] = await Promise.all([
    countActiveTriagePending(prisma),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM "AutonomiseWebhookIngest" i
      WHERE i.kind = 'event'
        AND (
          i."vehicleRego" LIKE ${`${TEST_INCIDENT_REGO_PREFIX}%`}
          OR i."vendorEventId" LIKE ${`${TEST_INCIDENT_EVENT_ID_PREFIX}%`}
        )
    `,
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM fatigue_incident_lifecycle l
      INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
      WHERE l.event_status = 'PENDING_TRIAGE'
        AND (
          e.vehicle_registration LIKE ${`${TEST_INCIDENT_REGO_PREFIX}%`}
          OR e.source_ingest_id IN (
            SELECT id FROM "AutonomiseWebhookIngest"
            WHERE "vendorEventId" LIKE ${`${TEST_INCIDENT_EVENT_ID_PREFIX}%`}
          )
        )
    `,
  ]);

  return {
    enabled: true,
    bridgeEnabled: isCommandLifecycleBridgeEnabled(),
    pendingTriageCount,
    pendingTestIngestCount: testIngestRows[0]?.count ?? 0,
    pendingTestLifecycleCount: testLifecycleRows[0]?.count ?? 0,
  };
}

export type PurgeTestIncidentsResult = {
  ingestIdsPurged: string[];
  lifecycleClosed: number;
  lifecycleDeleted: number;
  edgeEventsDeleted: number;
  ingestRowsDeleted: number;
};

export async function purgeTestIncidents(prisma: PrismaClient): Promise<PurgeTestIncidentsResult> {
  const ingests = await prisma.autonomiseWebhookIngest.findMany({
    where: {
      kind: "event",
      OR: [
        { vehicleRego: { startsWith: TEST_INCIDENT_REGO_PREFIX } },
        { vendorEventId: { startsWith: TEST_INCIDENT_EVENT_ID_PREFIX } },
      ],
    },
    select: { id: true },
  });

  const ingestIds = ingests.map((r) => r.id);
  if (ingestIds.length === 0) {
    return {
      ingestIdsPurged: [],
      lifecycleClosed: 0,
      lifecycleDeleted: 0,
      edgeEventsDeleted: 0,
      ingestRowsDeleted: 0,
    };
  }

  const ingestIdList = Prisma.join(ingestIds.map((id) => Prisma.sql`${id}`));

  const lifecycleClosed = await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle l
    SET event_status = 'CLOSED',
        closed_at = CURRENT_TIMESTAMP,
        operator_notes = COALESCE(operator_notes, 'Purged test desk incident')
    FROM edge_fatigue_events e
    WHERE l.event_id = e.event_id
      AND l.event_status = 'PENDING_TRIAGE'
      AND (
        e.vehicle_registration LIKE ${`${TEST_INCIDENT_REGO_PREFIX}%`}
        OR e.source_ingest_id IN (${ingestIdList})
      )
      AND EXISTS (
        SELECT 1 FROM lifecycle_transition_log t WHERE t.lifecycle_id = l.lifecycle_id
      )
  `;

  const lifecycleDeleted = await prisma.$executeRaw`
    DELETE FROM fatigue_incident_lifecycle l
    USING edge_fatigue_events e
    WHERE l.event_id = e.event_id
      AND (
        e.vehicle_registration LIKE ${`${TEST_INCIDENT_REGO_PREFIX}%`}
        OR e.source_ingest_id IN (${ingestIdList})
      )
      AND NOT EXISTS (
        SELECT 1 FROM lifecycle_transition_log t WHERE t.lifecycle_id = l.lifecycle_id
      )
  `;

  const edgeEventsDeleted = await prisma.$executeRaw`
    DELETE FROM edge_fatigue_events e
    WHERE e.vehicle_registration LIKE ${`${TEST_INCIDENT_REGO_PREFIX}%`}
       OR e.source_ingest_id IN (${ingestIdList})
  `;

  const batch = await deleteCameraAlertIngestBatch(prisma, ingestIds);

  return {
    ingestIdsPurged: batch.deletedIngestIds,
    lifecycleClosed,
    lifecycleDeleted,
    edgeEventsDeleted,
    ingestRowsDeleted: batch.deletedIngestIds.length,
  };
}
