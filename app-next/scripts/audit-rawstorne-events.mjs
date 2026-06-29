import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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
const clientId = (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim();
const primaryKey = process.env.AUTONOMISE_PRIMARY_KEY ?? "";
const baseUrl = "https://api.autonomise.ai";

const body = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: primaryKey,
  scope: "vt.api",
});
const tok = (
  await (
    await fetch("https://login.autonomise.ai/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
  ).json()
).access_token;

const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    kind: "event",
    accepted: true,
    vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
    OR: [{ driverName: { contains: "Rawstorne", mode: "insensitive" } }, { vehicleRego: "1IAV307" }],
    receivedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  orderBy: { receivedAt: "desc" },
  select: {
    id: true,
    vendorEventId: true,
    vehicleRego: true,
    driverName: true,
    receivedAt: true,
    mediaUrl: true,
    payload: true,
  },
});

console.log(`Found ${rows.length} Jan Rawstorne / 1IAV307 fatigue rows in Circadia DB\n`);

for (const r of rows) {
  const deviceId = r.payload?.device?.hardwareId ?? "";
  const trigger = r.payload?.triggerTime ?? null;
  const fnolId = r.payload?.id ?? null;
  const apiRes = await fetch(
    `${baseUrl}/device/${deviceId}/event/${r.vendorEventId}`,
    { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } }
  );
  const apiText = await apiRes.text();
  const apiOk = apiRes.status === 200 && apiText.length > 20;
  let apiTrigger = null;
  try {
    apiTrigger = JSON.parse(apiText).triggerTime ?? null;
  } catch {
    /* */
  }

  console.log({
    circadiaIngestId: r.id,
    vendorEventId: r.vendorEventId,
    fnolPayloadId: typeof fnolId === "string" ? fnolId.slice(0, 28) + "..." : null,
    rego: r.vehicleRego,
    driver: r.driverName,
    webhookReceivedUtc: r.receivedAt.toISOString(),
    payloadTriggerUtc: trigger,
    apiStatus: apiRes.status,
    apiHasEvent: apiOk,
    apiTriggerUtc: apiTrigger,
    hasMediaUrl: Boolean(r.mediaUrl),
    deviceId,
  });
  console.log("");
}

await prisma.$disconnect();
