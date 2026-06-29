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

const sample = await prisma.autonomiseWebhookIngest.findFirst({
  where: {
    kind: "event",
    accepted: true,
    vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
    receivedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  },
  orderBy: { receivedAt: "desc" },
  select: {
    id: true,
    vendorEventId: true,
    mediaUrl: true,
    receivedAt: true,
    payload: true,
  },
});

if (!sample) {
  console.log("no sample");
  process.exit(0);
}

console.log("SAMPLE EVENT", {
  id: sample.id,
  vendorEventId: sample.vendorEventId,
  mediaUrl: sample.mediaUrl,
  receivedAt: sample.receivedAt,
  payloadKeys: Object.keys(sample.payload ?? {}),
  payloadId: sample.payload?.id,
  payloadEventId: sample.payload?.event?.id,
});

const eventId = sample.vendorEventId;
const related = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    OR: [
      { vendorEventId: eventId },
      { linkedEventId: eventId },
      { vendorEventId: sample.payload?.event?.id },
      { linkedEventId: sample.payload?.event?.id },
    ],
  },
  select: {
    kind: true,
    vendorEventId: true,
    linkedEventId: true,
    mediaUrl: true,
    receivedAt: true,
    accepted: true,
  },
});

console.log("\nRELATED ROWS");
for (const r of related) {
  console.log({
    kind: r.kind,
    vendorEventId: r.vendorEventId,
    linkedEventId: r.linkedEventId,
    hasUrl: Boolean(r.mediaUrl),
    accepted: r.accepted,
    at: r.receivedAt.toISOString(),
  });
}

// Media webhooks for same device/time window
const deviceId = sample.payload?.device?.hardwareId;
const windowStart = new Date(sample.receivedAt.getTime() - 5 * 60 * 1000);
const windowEnd = new Date(sample.receivedAt.getTime() + 30 * 60 * 1000);
const nearbyMedia = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "media", receivedAt: { gte: windowStart, lte: windowEnd } },
  select: {
    vendorEventId: true,
    linkedEventId: true,
    mediaUrl: true,
    receivedAt: true,
    payload: true,
  },
  take: 5,
});

console.log("\nNEARBY MEDIA (±30m)", { deviceId, count: nearbyMedia.length });
for (const m of nearbyMedia) {
  console.log({
    linked: m.linkedEventId,
    vendor: m.vendorEventId,
    payloadEventId: m.payload?.event?.id,
    hasUrl: Boolean(m.mediaUrl),
    at: m.receivedAt.toISOString(),
  });
}

await prisma.$disconnect();
