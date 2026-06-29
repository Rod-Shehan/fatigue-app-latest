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

const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    kind: "event",
    accepted: true,
    vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
    mediaUrl: null,
    receivedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
  },
  orderBy: { receivedAt: "desc" },
  take: 15,
  select: { vendorEventId: true, receivedAt: true, payload: true, vehicleRego: true, driverName: true },
});

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

let apiHasClip = 0;
let apiEmpty = 0;

for (const row of rows) {
  const eventId = row.vendorEventId;
  const deviceId = row.payload?.device?.hardwareId ?? "";
  const res = await fetch(`${baseUrl}/device/${deviceId}/event/${eventId}/media`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  const hasMp4 = /\.mp4/i.test(text);
  if (hasMp4) apiHasClip++;
  else apiEmpty++;
  console.log({
    at: row.receivedAt.toISOString().slice(0, 16),
    driver: row.driverName,
    rego: row.vehicleRego,
    eventId: eventId?.slice(0, 8),
    apiStatus: res.status,
    hasClip: hasMp4,
    mediaItems: (text.match(/"uri"/g) ?? []).length,
  });
}

console.log(`\nSummary: ${apiHasClip} with clip on API, ${apiEmpty} empty (of ${rows.length} probed)`);
await prisma.$disconnect();
