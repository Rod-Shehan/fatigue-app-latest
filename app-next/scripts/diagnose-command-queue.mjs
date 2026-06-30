import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    }
  } catch {
    // ignore missing env file
  }
}

for (const f of [".env.production.local", ".env.local", ".env"]) loadEnv(f);

const prisma = new PrismaClient();

const totalPending = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c FROM fatigue_incident_lifecycle WHERE event_status = 'PENDING_TRIAGE'
`;

const filteredCount = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
  WHERE l.event_status = 'PENDING_TRIAGE'
    AND NOT EXISTS (
      SELECT 1 FROM "CameraAlertTriage" t
      WHERE t."ingestEventId" = e.source_ingest_id
         OR (
           t."vendorEventId" IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM "AutonomiseWebhookIngest" i
             WHERE i.id = e.source_ingest_id AND i."vendorEventId" = t."vendorEventId"
           )
         )
    )
`;

const managerTriagedStillPending = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  INNER JOIN edge_fatigue_events e ON e.event_id = l.event_id
  WHERE l.event_status = 'PENDING_TRIAGE'
    AND EXISTS (
      SELECT 1 FROM "CameraAlertTriage" t
      WHERE t."ingestEventId" = e.source_ingest_id
         OR (
           t."vendorEventId" IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM "AutonomiseWebhookIngest" i
             WHERE i.id = e.source_ingest_id AND i."vendorEventId" = t."vendorEventId"
           )
         )
    )
`;

const noSourceIngest = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  JOIN edge_fatigue_events e ON e.event_id = l.event_id
  WHERE l.event_status = 'PENDING_TRIAGE' AND e.source_ingest_id IS NULL
`;

const pending = await prisma.$queryRaw`
  SELECT
    l.lifecycle_id::text AS lifecycle_id,
    e.vehicle_registration,
    e.fatigue_metric_type,
    l.detected_at,
    e.source_ingest_id,
    i."vendorEventId",
    EXISTS (
      SELECT 1 FROM "CameraAlertTriage" t
      WHERE t."ingestEventId" = e.source_ingest_id
         OR (
           t."vendorEventId" IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM "AutonomiseWebhookIngest" i2
             WHERE i2.id = e.source_ingest_id AND i2."vendorEventId" = t."vendorEventId"
           )
         )
    ) AS manager_triaged
  FROM fatigue_incident_lifecycle l
  JOIN edge_fatigue_events e ON e.event_id = l.event_id
  LEFT JOIN "AutonomiseWebhookIngest" i ON i.id = e.source_ingest_id
  WHERE l.event_status = 'PENDING_TRIAGE'
  ORDER BY l.detected_at DESC
  LIMIT 25
`;

const managerPendingIngest = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM "AutonomiseWebhookIngest" i
  WHERE i.kind = 'event' AND i.accepted = true
    AND NOT EXISTS (SELECT 1 FROM "CameraAlertTriage" t WHERE t."ingestEventId" = i.id)
    AND EXISTS (
      SELECT 1 FROM edge_fatigue_events e
      JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
      WHERE e.source_ingest_id = i.id AND l.event_status = 'PENDING_TRIAGE'
    )
`;

const orphanedIngest = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  JOIN edge_fatigue_events e ON e.event_id = l.event_id
  WHERE l.event_status = 'PENDING_TRIAGE'
    AND e.source_ingest_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "AutonomiseWebhookIngest" i WHERE i.id = e.source_ingest_id
    )
`;

const triageCount = await prisma.cameraAlertTriage.count();
const recentTriage = await prisma.cameraAlertTriage.findMany({
  orderBy: { decidedAt: "desc" },
  take: 5,
  select: { ingestEventId: true, decision: true, decidedAt: true, vendorEventId: true },
});

const managerPending = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM "AutonomiseWebhookIngest" i
  WHERE i.kind = 'event' AND i.accepted = true
    AND i."receivedAt" >= NOW() - INTERVAL '168 hours'
    AND NOT EXISTS (SELECT 1 FROM "CameraAlertTriage" t WHERE t."ingestEventId" = i.id)
    AND NOT EXISTS (
      SELECT 1 FROM edge_fatigue_events e
      JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
      WHERE e.source_ingest_id = i.id
        AND l.event_status != 'PENDING_TRIAGE'
    )
`;

const closedByStatus = await prisma.$queryRaw`
  SELECT event_status, COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle
  GROUP BY event_status
  ORDER BY c DESC
`;

const lifecycleBuckets = await prisma.$queryRaw`
  SELECT
    CASE
      WHEN l.event_status = 'PENDING_TRIAGE' AND EXISTS (
        SELECT 1 FROM "CameraAlertTriage" t
        WHERE t."ingestEventId" = e.source_ingest_id
           OR (
             t."vendorEventId" IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM "AutonomiseWebhookIngest" i
               WHERE i.id = e.source_ingest_id AND i."vendorEventId" = t."vendorEventId"
             )
           )
      ) THEN 'reopen_bug_still_pending'
      WHEN l.event_status = 'PENDING_TRIAGE' THEN 'never_triaged_pending'
      WHEN l.event_status != 'PENDING_TRIAGE' AND EXISTS (
        SELECT 1 FROM "CameraAlertTriage" t
        WHERE t."ingestEventId" = e.source_ingest_id
           OR (
             t."vendorEventId" IS NOT NULL
             AND EXISTS (
               SELECT 1 FROM "AutonomiseWebhookIngest" i
               WHERE i.id = e.source_ingest_id AND i."vendorEventId" = t."vendorEventId"
             )
           )
      ) THEN 'manager_or_command_triaged_closed'
      ELSE 'closed_no_triage_record'
    END AS bucket,
    COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  JOIN edge_fatigue_events e ON e.event_id = l.event_id
  GROUP BY 1
  ORDER BY c DESC
`;

const triageByActor = await prisma.$queryRaw`
  SELECT
    CASE WHEN "decidedByUserId" LIKE 'command:%' THEN 'command' ELSE 'manager' END AS actor,
    decision,
    COUNT(*)::int AS c
  FROM "CameraAlertTriage"
  GROUP BY 1, 2
  ORDER BY 1, 2
`;

console.log(
  JSON.stringify(
    {
      totalPending: totalPending[0]?.c,
      commandQueueCount: filteredCount[0]?.c,
      managerTriagedStillPending: managerTriagedStillPending[0]?.c,
      noSourceIngest: noSourceIngest[0]?.c,
      orphanedIngest: orphanedIngest[0]?.c,
      managerPendingMatchingCommand: managerPendingIngest[0]?.c,
      managerPending168h: managerPending[0]?.c,
      triageCount,
      lifecycleBuckets,
      triageByActor,
      recentTriage,
      closedByStatus,
      sample: pending,
    },
    null,
    2
  )
);

await prisma.$disconnect();
