import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    readFileSync(path, "utf8").split("\n").forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) return;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    });
  } catch {
    /* */
  }
}

loadEnvFile(".env.local");

const prisma = new PrismaClient();
const deviceId = "00d2047b0f";

const media = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    kind: "media",
    receivedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    payload: { path: ["device", "hardwareId"], equals: deviceId },
  },
  orderBy: { receivedAt: "desc" },
  take: 5,
  select: {
    id: true,
    vendorEventId: true,
    linkedEventId: true,
    mediaUrl: true,
    receivedAt: true,
    payload: true,
  },
});

console.log("=== Recent media for device", deviceId, "===");
for (const m of media) {
  const eventIdFromPayload = m.payload?.event?.id ?? null;
  console.log({
    mediaIngestId: m.id,
    receivedAt: m.receivedAt.toISOString(),
    storedVendorEventId: m.vendorEventId,
    storedLinkedEventId: m.linkedEventId,
    payloadEventId: eventIdFromPayload,
    hasClip: Boolean(m.mediaUrl),
  });

  const keys = [m.linkedEventId, m.vendorEventId, eventIdFromPayload].filter(Boolean);
  const events = await prisma.autonomiseWebhookIngest.findMany({
    where: {
      kind: "event",
      OR: [
        { vendorEventId: { in: keys } },
        { linkedEventId: { in: keys } },
      ],
    },
    select: {
      id: true,
      vendorEventId: true,
      vendorAlarmId: true,
      accepted: true,
      receivedAt: true,
      payload: true,
    },
  });
  console.log(
    "  matching event rows:",
    events.length
      ? events.map((e) => ({
          id: e.id.slice(0, 12),
          vendorEventId: e.vendorEventId,
          alarm: e.vendorAlarmId,
          eventTypes: e.payload?.eventTypes,
          accepted: e.accepted,
          receivedAt: e.receivedAt.toISOString(),
        }))
      : "NONE"
  );
}

await prisma.$disconnect();
