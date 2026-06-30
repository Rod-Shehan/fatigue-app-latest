/**
 * Compare manager inbox "Need review" vs Command triage queue.
 */
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
    // ignore
  }
}

for (const f of [".env.production.local", ".env.local", ".env"]) loadEnv(f);

const prisma = new PrismaClient();

const commandPending = await prisma.$queryRaw`
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

for (const hours of [1, 6, 12, 24, 48, 168]) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS manager_need_review
    FROM "AutonomiseWebhookIngest" i
    WHERE i.kind = 'event'
      AND i.accepted = true
      AND i."receivedAt" >= NOW() - (${hours}::int * INTERVAL '1 hour')
      AND NOT EXISTS (
        SELECT 1 FROM "CameraAlertTriage" t WHERE t."ingestEventId" = i.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM edge_fatigue_events e
        JOIN fatigue_incident_lifecycle l ON l.event_id = e.event_id
        WHERE e.source_ingest_id = i.id
          AND l.event_status != 'PENDING_TRIAGE'
      )
  `;
  console.log(`hours=${hours}: manager_need_review=${rows[0]?.manager_need_review}`);
}

const outside24h = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  JOIN edge_fatigue_events e ON e.event_id = l.event_id
  JOIN "AutonomiseWebhookIngest" i ON i.id = e.source_ingest_id
  WHERE l.event_status = 'PENDING_TRIAGE'
    AND i."receivedAt" < NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (SELECT 1 FROM "CameraAlertTriage" t WHERE t."ingestEventId" = i.id)
`;

const onCommandNotBridged = await prisma.$queryRaw`
  SELECT COUNT(*)::int AS c
  FROM "AutonomiseWebhookIngest" i
  WHERE i.kind = 'event' AND i.accepted = true
    AND i."receivedAt" >= NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM edge_fatigue_events e WHERE e.source_ingest_id = i.id
    )
    AND NOT EXISTS (SELECT 1 FROM "CameraAlertTriage" t WHERE t."ingestEventId" = i.id)
`;

const pendingByRego = await prisma.$queryRaw`
  SELECT e.vehicle_registration, COUNT(*)::int AS c
  FROM fatigue_incident_lifecycle l
  JOIN edge_fatigue_events e ON e.event_id = l.event_id
  WHERE l.event_status = 'PENDING_TRIAGE'
  GROUP BY e.vehicle_registration
  ORDER BY c DESC
  LIMIT 8
`;

console.log(
  JSON.stringify(
    {
      commandPending: commandPending[0]?.c,
      commandPendingOutsideManager24h: outside24h[0]?.c,
      managerIngestNotOnCommand24h: onCommandNotBridged[0]?.c,
      pendingByRego,
    },
    null,
    2
  )
);

await prisma.$disconnect();
