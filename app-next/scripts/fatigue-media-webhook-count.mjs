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
  where: { kind: "event", accepted: true, receivedAt: { gte: since } },
  select: { vendorEventId: true, vendorAlarmId: true, mediaUrl: true },
});

const fatigueIds = new Set(
  events.filter((e) => e.vendorAlarmId === "VT3600AI_ALARM_DSM_Fatigue").map((e) => e.vendorEventId)
);

const media = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "media", receivedAt: { gte: since } },
  select: { payload: true, mediaUrl: true, linkedEventId: true, receivedAt: true },
});

let fatigueMediaWebhooks = 0;
for (const m of media) {
  const eventId = m.payload?.event?.id;
  if (eventId && fatigueIds.has(eventId)) fatigueMediaWebhooks++;
}

console.log({
  acceptedFatigue: fatigueIds.size,
  mediaWebhooksTotal: media.length,
  mediaWebhooksForFatigue: fatigueMediaWebhooks,
  fatigueWithClip: events.filter(
    (e) => e.vendorAlarmId === "VT3600AI_ALARM_DSM_Fatigue" && e.mediaUrl
  ).length,
});

await prisma.$disconnect();
