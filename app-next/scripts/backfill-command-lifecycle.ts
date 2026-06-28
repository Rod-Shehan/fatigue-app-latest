/**
 * Backfill accepted Autonomise event ingests into Command triage (edge_fatigue_events).
 * Usage: npx tsx scripts/backfill-command-lifecycle.ts [--limit=200]
 */
import { PrismaClient } from "@prisma/client";
import { maybePromoteAutonomiseToCommandLifecycle } from "../src/lib/integrations/command-lifecycle-bridge";
import { isCommandLifecycleBridgeEnabled } from "../src/lib/integrations/command-lifecycle-bridge-config";

const prisma = new PrismaClient();

function parseLimit(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith("--limit="));
  if (!flag) return 500;
  const n = Number.parseInt(flag.split("=")[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

async function main() {
  if (!isCommandLifecycleBridgeEnabled()) {
    console.error("Bridge disabled — set COMMAND_PILOT_TENANT_ID_UUID or COMMAND_LIFECYCLE_BRIDGE_ENABLED=true");
    process.exit(1);
  }

  const limit = parseLimit(process.argv.slice(2));
  const rows = await prisma.autonomiseWebhookIngest.findMany({
    where: { kind: "event", accepted: true },
    orderBy: { receivedAt: "desc" },
    take: limit,
    select: {
      id: true,
      vendorAlarmId: true,
      vehicleRego: true,
      driverName: true,
      mediaUrl: true,
      payload: true,
    },
  });

  let promoted = 0;
  let skipped = 0;
  let mediaUpdated = 0;

  for (const row of rows) {
    const result = await maybePromoteAutonomiseToCommandLifecycle(prisma, {
      ingestId: row.id,
      vendorAlarmId: row.vendorAlarmId,
      vehicleRego: row.vehicleRego,
      driverName: row.driverName,
      mediaUrl: row.mediaUrl,
      payload: row.payload,
    });
    if (result.promoted) promoted += 1;
    else if (result.mediaUpdated) mediaUpdated += 1;
    else skipped += 1;
  }

  console.log(
    `Processed ${rows.length} accepted event ingests: promoted=${promoted}, mediaUpdated=${mediaUpdated}, skipped=${skipped}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
