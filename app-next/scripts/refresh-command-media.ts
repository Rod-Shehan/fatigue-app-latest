/**
 * Re-resolve driver-camera clips on promoted Command edge events (fixes forward-camera URLs).
 * Usage: npx tsx scripts/refresh-command-media.ts [--limit=100]
 */
import { PrismaClient } from "@prisma/client";
import { resolveReviewMediaUrl } from "../src/lib/integrations/autonomise-media-extract";
import { isCommandLifecycleBridgeEnabled } from "../src/lib/integrations/command-lifecycle-bridge-config";

const prisma = new PrismaClient();

function parseLimit(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith("--limit="));
  if (!flag) return 200;
  const n = Number.parseInt(flag.split("=")[1] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 200;
}

async function main() {
  if (!isCommandLifecycleBridgeEnabled()) {
    console.error("Set COMMAND_PILOT_TENANT_ID_UUID first");
    process.exit(1);
  }

  const limit = parseLimit(process.argv.slice(2));
  const rows = await prisma.$queryRaw<
    Array<{ event_id: string; source_ingest_id: string; video_snippet_url: string }>
  >`
    SELECT event_id, source_ingest_id, video_snippet_url
    FROM edge_fatigue_events
    WHERE source_ingest_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const ingest = await prisma.autonomiseWebhookIngest.findUnique({
      where: { id: row.source_ingest_id },
      select: { vendorAlarmId: true, mediaUrl: true, payload: true },
    });
    if (!ingest) {
      skipped += 1;
      continue;
    }

    const clip = resolveReviewMediaUrl(ingest.payload, ingest.vendorAlarmId, ingest.mediaUrl);
    if (!clip || clip === row.video_snippet_url) {
      skipped += 1;
      continue;
    }

    await prisma.$executeRaw`
      UPDATE edge_fatigue_events
      SET video_snippet_url = ${clip}
      WHERE event_id = ${row.event_id}::uuid
    `;
    updated += 1;
    console.log(`Updated ${row.event_id} → driver clip`);
  }

  console.log(`Done. updated=${updated}, skipped=${skipped}, scanned=${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
