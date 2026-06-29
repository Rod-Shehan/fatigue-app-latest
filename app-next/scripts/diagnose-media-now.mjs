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
const since = new Date(Date.now() - 48 * 60 * 60 * 1000);

const events = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", receivedAt: { gte: since } },
  orderBy: { receivedAt: "desc" },
  take: 80,
  select: {
    id: true,
    vendorEventId: true,
    vendorAlarmId: true,
    accepted: true,
    mediaUrl: true,
    vehicleRego: true,
    receivedAt: true,
    payload: true,
  },
});

const { getAutonomiseEventTypeCodeMap } = await import(
  "../src/lib/integrations/autonomise-event-type-codes.ts"
);
const { evaluateAutonomiseEventAcceptance } = await import(
  "../src/lib/integrations/autonomise-event-evaluation.ts"
);
const { getEnabledAlarmIdSet } = await import(
  "../src/lib/integrations/camera-alert-event-settings.ts"
);
const { resolveAndPersistAutonomiseMedia, isAutonomiseApiConfigured } = await import(
  "../src/lib/integrations/autonomise-media-resolver.ts"
);
const { extractAutonomiseFields } = await import("../src/lib/integrations/autonomise-payload.ts");

const enabled = await getEnabledAlarmIdSet(prisma);
const codeMap = getAutonomiseEventTypeCodeMap();

console.log("apiConfigured", isAutonomiseApiConfigured());
console.log("enabled alarm count", enabled.size);

let acceptedNow = 0;
let withUrl = 0;
let acceptedNoUrl = 0;

const candidates = [];
for (const row of events) {
  const fields = extractAutonomiseFields(row.payload, "event");
  const alarm = fields.vendorAlarmId ?? row.vendorAlarmId;
  const { accepted } = evaluateAutonomiseEventAcceptance(alarm, enabled);
  if (!accepted) continue;
  acceptedNow++;
  if (row.mediaUrl) {
    withUrl++;
  } else {
    acceptedNoUrl++;
    if (candidates.length < 5) {
      candidates.push({ ...row, alarm, eventTypes: row.payload?.eventTypes });
    }
  }
}

console.log(`\n48h: ${acceptedNow} accepted (re-eval), ${withUrl} with mediaUrl, ${acceptedNoUrl} without`);

console.log("\n=== Try live API fetch for up to 5 accepted without url ===");
for (const c of candidates) {
  const eventTypes = c.eventTypes;
  const typeLabel = eventTypes?.map((t) => `${t}=${codeMap[t] ?? "?"}`).join(",");
  console.log("\n", {
    rego: c.vehicleRego,
    alarm: c.alarm,
    eventTypes: typeLabel,
    eventId: c.vendorEventId?.slice(0, 8),
    received: c.receivedAt.toISOString().slice(0, 16),
  });
  const result = await resolveAndPersistAutonomiseMedia(prisma, {
    eventId: c.vendorEventId,
    payload: c.payload,
  });
  console.log("fetch result", result);
}

console.log("\n=== Events WITH mediaUrl (recent) ===");
const withMedia = events.filter((e) => e.mediaUrl);
for (const r of withMedia.slice(0, 5)) {
  console.log({
    alarm: r.vendorAlarmId,
    rego: r.vehicleRego,
    eventTypes: r.payload?.eventTypes,
    at: r.receivedAt.toISOString(),
    url: r.mediaUrl?.slice(0, 70) + "...",
  });
}

await prisma.$disconnect();
