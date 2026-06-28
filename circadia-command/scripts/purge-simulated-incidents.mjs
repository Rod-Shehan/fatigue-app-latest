/**
 * Remove SIM* dev simulate-ingest rows from shared Neon.
 * Pending rows are closed (queue-safe). Rows without audit history are hard-deleted.
 * Usage: node scripts/purge-simulated-incidents.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const simEvents = await prisma.$queryRaw`
    SELECT event_id, vehicle_registration
    FROM edge_fatigue_events
    WHERE vehicle_registration LIKE 'SIM%'
  `;

  if (!Array.isArray(simEvents) || simEvents.length === 0) {
    console.log("No SIM* edge events found.");
    return;
  }

  console.log(`Found ${simEvents.length} simulated edge event(s).`);

  const closedPending = await prisma.$executeRaw`
    UPDATE fatigue_incident_lifecycle fil
    SET event_status = 'CLOSED',
        closed_at = CURRENT_TIMESTAMP,
        operator_notes = COALESCE(operator_notes, 'Purged simulated dev ingest')
    FROM edge_fatigue_events efe
    WHERE fil.event_id = efe.event_id
      AND efe.vehicle_registration LIKE 'SIM%'
      AND fil.event_status = 'PENDING_TRIAGE'
  `;

  const deletedLifecycle = await prisma.$executeRaw`
    DELETE FROM fatigue_incident_lifecycle fil
    USING edge_fatigue_events efe
    WHERE fil.event_id = efe.event_id
      AND efe.vehicle_registration LIKE 'SIM%'
      AND NOT EXISTS (
        SELECT 1 FROM lifecycle_transition_log l WHERE l.lifecycle_id = fil.lifecycle_id
      )
  `;

  const deletedEvents = await prisma.$executeRaw`
    DELETE FROM edge_fatigue_events efe
    WHERE efe.vehicle_registration LIKE 'SIM%'
      AND NOT EXISTS (
        SELECT 1 FROM fatigue_incident_lifecycle fil WHERE fil.event_id = efe.event_id
      )
  `;

  console.log(
    `Done. closed_pending=${closedPending}, lifecycle_deleted=${deletedLifecycle}, edge_events_deleted=${deletedEvents}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
