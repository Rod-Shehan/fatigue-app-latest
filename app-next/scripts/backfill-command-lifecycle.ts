/**
 * Backfill accepted Autonomise event ingests into Command triage (edge_fatigue_events).
 * Usage: npx tsx scripts/backfill-command-lifecycle.ts [--limit=200]
 */
import { PrismaClient } from "@prisma/client";
import { promoteAcceptedIngestBacklog } from "../src/lib/integrations/command-lifecycle-bridge";
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
  const { promoted, skipped } = await promoteAcceptedIngestBacklog(prisma, { limit });
  console.log(`Processed up to ${limit} unqueued accepted event ingests: promoted=${promoted}, skipped=${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
