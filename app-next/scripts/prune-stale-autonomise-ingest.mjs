/**
 * Remove stale Autonomise pilot ingest rows — keeps events with a stored clip
 * and their paired media webhooks.
 *
 * Usage: node scripts/prune-stale-autonomise-ingest.mjs [--dry-run]
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnvFile(".env.production.local");
const dryRun = process.argv.includes("--dry-run");
const prisma = new PrismaClient();

try {
  const rows = await prisma.autonomiseWebhookIngest.findMany({
    select: {
      id: true,
      kind: true,
      vendorEventId: true,
      linkedEventId: true,
      mediaUrl: true,
      receivedAt: true,
    },
  });

  const keptEventVendorIds = new Set(
    rows
      .filter((r) => r.kind === "event" && r.mediaUrl)
      .map((r) => r.vendorEventId)
      .filter(Boolean)
  );

  const keepIds = new Set();
  for (const row of rows) {
    if (row.kind === "event" && row.mediaUrl) {
      keepIds.add(row.id);
      continue;
    }
    if (row.kind === "media" && row.mediaUrl) {
      const key = row.linkedEventId ?? row.vendorEventId;
      if (key && keptEventVendorIds.has(key)) {
        keepIds.add(row.id);
      }
    }
  }

  const deleteIds = rows.filter((r) => !keepIds.has(r.id)).map((r) => r.id);

  console.log(
    JSON.stringify(
      {
        dryRun,
        total: rows.length,
        keeping: [...keepIds],
        deleting: deleteIds.length,
      },
      null,
      2
    )
  );

  if (!dryRun && deleteIds.length > 0) {
    const triage = await prisma.cameraAlertTriage.deleteMany({
      where: { ingestEventId: { in: deleteIds } },
    });
    const deleted = await prisma.autonomiseWebhookIngest.deleteMany({
      where: { id: { in: deleteIds } },
    });
    console.log("deleted", { ingest: deleted.count, triage: triage.count });
  }
} finally {
  await prisma.$disconnect();
}
