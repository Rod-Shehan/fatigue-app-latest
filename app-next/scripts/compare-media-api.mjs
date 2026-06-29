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

const withUrl = await prisma.autonomiseWebhookIngest.findMany({
  where: { kind: "event", accepted: true, NOT: { mediaUrl: null } },
  orderBy: { receivedAt: "desc" },
  take: 3,
  select: { vendorEventId: true, vendorAlarmId: true, receivedAt: true, payload: true, mediaUrl: true },
});

const body = new URLSearchParams({
  grant_type: "client_credentials",
  client_id: clientId,
  client_secret: primaryKey,
  scope: "vt.api",
});
const tokRes = await fetch("https://login.autonomise.ai/connect/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});
const tok = (await tokRes.json()).access_token;

async function probe(eventId, deviceId) {
  const res = await fetch(`${baseUrl}/device/${deviceId}/event/${eventId}/media`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  return {
    eventId: eventId?.slice(0, 8),
    status: res.status,
    hasMp4: /\.mp4/i.test(text),
    mediaCount: (text.match(/"uri"/g) ?? []).length,
    body: text.slice(0, 200),
  };
}

console.log("=== Events WITH stored mediaUrl ===");
for (const row of withUrl) {
  const deviceId = row.payload?.device?.hardwareId ?? "";
  console.log({
    alarm: row.vendorAlarmId,
    at: row.receivedAt.toISOString(),
    stored: row.mediaUrl?.slice(0, 60) + "...",
    api: await probe(row.vendorEventId, deviceId),
  });
}

console.log("\n=== Jan Rawstorne event (no stored url) ===");
console.log(
  await probe("e6bb7de6-9279-4655-9675-dc85ffab4e78", "00d2047b17")
);

await prisma.$disconnect();
