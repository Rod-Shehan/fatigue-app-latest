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
const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

const events = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", receivedAt: { gte: since } },
  select: { vendorAlarmId: true, accepted: true, mediaUrl: true },
});

const byAlarm = new Map();
for (const e of events) {
  const key = e.vendorAlarmId ?? "unknown";
  const cur = byAlarm.get(key) ?? { total: 0, accepted: 0, withClip: 0 };
  cur.total++;
  if (e.accepted) {
    cur.accepted++;
    if (e.mediaUrl) cur.withClip++;
  }
  byAlarm.set(key, cur);
}

console.log("=== Clip rate by alarm type (48h) ===");
for (const [alarm, s] of [...byAlarm.entries()].sort((a, b) => b[1].accepted - a[1].accepted)) {
  console.log({
    alarm,
    accepted: s.accepted,
    withClip: s.withClip,
    clipRate: s.accepted ? `${Math.round((s.withClip / s.accepted) * 100)}%` : "n/a",
  });
}

const media = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "media", receivedAt: { gte: since } },
  select: { linkedEventId: true, mediaUrl: true, receivedAt: true },
});

const eventIds = new Set(events.map((e) => e.vendorEventId).filter(Boolean));
let mediaForAccepted = 0;
let mediaForFiltered = 0;
for (const m of media) {
  const id = m.linkedEventId;
  if (!id) continue;
  const ev = events.find((e) => e.vendorEventId === id);
  if (!ev) continue;
  if (ev.accepted) mediaForAccepted++;
  else mediaForFiltered++;
}

console.log("\n=== Media webhooks (48h) ===");
console.log({ total: media.length, forAcceptedEvents: mediaForAccepted, forFilteredEvents: mediaForFiltered });

await prisma.$disconnect();
