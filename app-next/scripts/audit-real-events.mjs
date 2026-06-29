import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[m[1].trim()] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(
  join(process.env.USERPROFILE ?? "", "OneDrive", "Documents", "autonomise-fleet-alerts", "backend", ".env")
);

const prisma = new PrismaClient();
const since = new Date(Date.now() - 72 * 60 * 60 * 1000);

const events = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", receivedAt: { gte: since } },
  orderBy: { receivedAt: "desc" },
  select: {
    vendorEventId: true,
    vendorAlarmId: true,
    accepted: true,
    mediaUrl: true,
    vehicleRego: true,
    receivedAt: true,
    payload: true,
  },
});

const realFatigue = events.filter((e) => e.payload?.eventTypes?.includes(18));
const realAdas28 = events.filter((e) => e.payload?.eventTypes?.includes(28));
const speedAsFatigue = events.filter(
  (e) => e.payload?.eventTypes?.includes(2) && e.vendorAlarmId?.includes("Fatigue")
);

console.log("Real fatigue (type 18):", realFatigue.length);
for (const e of realFatigue.slice(0, 5)) {
  console.log({
    rego: e.vehicleRego,
    at: e.receivedAt.toISOString(),
    mediaUrl: e.mediaUrl ? "YES" : "NO",
    eventId: e.vendorEventId?.slice(0, 8),
  });
}

console.log("\nADAS type 28:", realAdas28.length);
for (const e of realAdas28.slice(0, 5)) {
  console.log({
    rego: e.vehicleRego,
    at: e.receivedAt.toISOString(),
    mediaUrl: e.mediaUrl ? "YES" : "NO",
    eventId: e.vendorEventId?.slice(0, 8),
  });
}

console.log("\nSpeed mis-stored as fatigue in DB:", speedAsFatigue.length);

const media = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "media", receivedAt: { gte: since }, NOT: { mediaUrl: null } },
  select: { linkedEventId: true, vendorEventId: true, mediaUrl: true, receivedAt: true, payload: true },
});

const eventIds = new Set(events.map((e) => e.vendorEventId).filter(Boolean));
let orphanWithUrl = 0;
for (const m of media) {
  const key = m.linkedEventId ?? m.payload?.event?.id;
  if (key && !eventIds.has(key)) orphanWithUrl++;
}
console.log("\nMedia webhooks with URL:", media.length);
console.log("Orphan media (no event row for linked id):", orphanWithUrl);

await prisma.$disconnect();
