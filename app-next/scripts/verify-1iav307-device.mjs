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

async function apiGet(path) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: text.slice(0, 300) };
  }
}

const prisma = new PrismaClient();
const DEVICE_ID = "00d2047b17";
const VEHICLE_ID_FROM_WEBHOOK = "344cd53a-18fc-f011-8330-6045bd11aa2c";
const SAMPLE_EVENT = "e6bb7de6-9279-4655-9675-dc85ffab4e78";

console.log("=== Device API ===");
console.log(await apiGet(`/device/${DEVICE_ID}`));

console.log("\n=== Vehicle API (from webhook payload) ===");
console.log(await apiGet(`/vehicle/${VEHICLE_ID_FROM_WEBHOOK}`));

console.log("\n=== Sample event detail ===");
const ev = await apiGet(`/device/${DEVICE_ID}/event/${SAMPLE_EVENT}`);
console.log("status", ev.status);
if (ev.data && typeof ev.data === "object") {
  const e = ev.data;
  console.log({
    id: e.id,
    triggerTime: e.triggerTime,
    receivedTime: e.receivedTime,
    eventTypes: e.eventTypes,
    classification: e.classification,
    categories: e.categories,
    speedPoints: e.speedPoints,
    address: e.address?.street + ", " + e.address?.city,
  });
}

console.log("\n=== All 1IAV307 fatigue rows in Circadia ===");
const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", vehicleRego: "1IAV307", vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue" },
  orderBy: { receivedAt: "desc" },
  take: 10,
  select: {
    vendorEventId: true,
    receivedAt: true,
    payload: true,
    vehicleRego: true,
    driverName: true,
  },
});
for (const r of rows) {
  console.log({
    eventId: r.vendorEventId,
    webhookPayloadVehicleId: r.payload?.vehicle?.id,
    webhookDeviceId: r.payload?.device?.hardwareId,
    eventTypes: r.payload?.eventTypes,
    classification: r.payload?.classification,
    triggerTime: r.payload?.triggerTime,
    receivedAt: r.receivedAt.toISOString(),
    driverName: r.driverName,
  });
}

console.log("\n=== Events in DB for device 00d2047b17 (any alarm) ===");
const deviceRows = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    kind: "event",
    receivedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  orderBy: { receivedAt: "desc" },
  take: 200,
  select: { vendorEventId: true, vendorAlarmId: true, vehicleRego: true, payload: true, receivedAt: true },
});
const forDevice = deviceRows.filter((r) => r.payload?.device?.hardwareId === DEVICE_ID);
console.log(`count: ${forDevice.length}`);
const byAlarm = {};
for (const r of forDevice) {
  byAlarm[r.vendorAlarmId ?? "?"] = (byAlarm[r.vendorAlarmId ?? "?"] ?? 0) + 1;
}
console.log("by alarm:", byAlarm);

await prisma.$disconnect();
