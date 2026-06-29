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

const prisma = new PrismaClient();
const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

const withMedia = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", mediaUrl: { not: null }, receivedAt: { gte: since } },
  orderBy: { receivedAt: "desc" },
  take: 8,
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

console.log("Events with mediaUrl in last 24h:", withMedia.length);
for (const e of withMedia) {
  const res = await fetch(e.mediaUrl, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
  console.log({
    alarm: e.vendorAlarmId?.replace("VT3600AI_ALARM_", ""),
    rego: e.vehicleRego,
    accepted: e.accepted,
    eventTypes: e.payload?.eventTypes,
    at: e.receivedAt.toISOString().slice(0, 16),
    urlStatus: res.status,
  });
}

const settings = await prisma.cameraAlertEventSettings.findUnique({ where: { id: "default" } });
console.log("\nEnabled alarms in DB:", settings?.enabledAlarmIds);

await prisma.$disconnect();
