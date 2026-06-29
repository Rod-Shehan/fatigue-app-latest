import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.local");

const prisma = new PrismaClient();
const hours = 48;
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

const events = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", receivedAt: { gte: since } },
  orderBy: { receivedAt: "desc" },
  select: {
    id: true,
    vendorEventId: true,
    vendorAlarmId: true,
    accepted: true,
    mediaUrl: true,
    receivedAt: true,
  },
});

const media = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "media", receivedAt: { gte: since } },
  select: {
    vendorEventId: true,
    linkedEventId: true,
    mediaUrl: true,
    receivedAt: true,
  },
});

const mediaByEvent = new Map();
for (const m of media) {
  const key = m.linkedEventId ?? m.vendorEventId;
  if (!key) continue;
  if (!mediaByEvent.has(key)) mediaByEvent.set(key, m);
}

const accepted = events.filter((e) => e.accepted);
const acceptedWithUrl = accepted.filter((e) => e.mediaUrl);
const acceptedNoUrl = accepted.filter((e) => !e.mediaUrl);

let withMediaWebhook = 0;
let mediaWebhookAfterMs = [];
for (const e of acceptedNoUrl) {
  const m = e.vendorEventId ? mediaByEvent.get(e.vendorEventId) : null;
  if (m) {
    withMediaWebhook++;
    mediaWebhookAfterMs.push(m.receivedAt.getTime() - e.receivedAt.getTime());
  }
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : "n/a";
}

console.log(`=== Pipeline snapshot (last ${hours}h) ===`);
console.log(`Events total: ${events.length}`);
console.log(`Accepted: ${accepted.length}`);
console.log(`Accepted WITH mediaUrl on event row: ${acceptedWithUrl.length} (${pct(acceptedWithUrl.length, accepted.length)})`);
console.log(`Accepted WITHOUT mediaUrl: ${acceptedNoUrl.length} (${pct(acceptedNoUrl.length, accepted.length)})`);
console.log(`  of those, media webhook exists: ${withMediaWebhook} (link/match issue?)`);
console.log(`Media webhooks total: ${media.length}`);
console.log(`Media webhooks WITH url: ${media.filter((m) => m.mediaUrl).length}`);

if (mediaWebhookAfterMs.length) {
  mediaWebhookAfterMs.sort((a, b) => a - b);
  const median = mediaWebhookAfterMs[Math.floor(mediaWebhookAfterMs.length / 2)];
  const max = mediaWebhookAfterMs[mediaWebhookAfterMs.length - 1];
  console.log(`Media webhook lag (accepted, no url on event): median ${Math.round(median / 1000)}s, max ${Math.round(max / 1000)}s`);
}

console.log("\n=== Recent accepted without clip (last 10) ===");
for (const e of acceptedNoUrl.slice(0, 10)) {
  const m = e.vendorEventId ? mediaByEvent.get(e.vendorEventId) : null;
  console.log({
    at: e.receivedAt.toISOString(),
    alarm: e.vendorAlarmId,
    eventId: e.vendorEventId?.slice(0, 8),
    eventRowUrl: Boolean(e.mediaUrl),
    mediaWebhook: m ? m.receivedAt.toISOString() : null,
    mediaWebhookUrl: Boolean(m?.mediaUrl),
    lagSec: m ? Math.round((m.receivedAt.getTime() - e.receivedAt.getTime()) / 1000) : null,
  });
}

await prisma.$disconnect();
