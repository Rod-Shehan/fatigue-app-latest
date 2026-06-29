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

const eventId = "e6bb7de6-9279-4655-9675-dc85ffab4e78";
const deviceId = "00d2047b17";
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

const paths = [
  `/device/${deviceId}/event/${eventId}/media`,
  `/device/${deviceId}/event/${eventId}`,
  `/v1/events/${eventId}?clientId=${encodeURIComponent(clientId)}`,
  `/events/${eventId}?clientId=${encodeURIComponent(clientId)}`,
];

for (const path of paths) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  console.log("\n---", path, "status", res.status, "---");
  console.log(text.slice(0, 500));
}

const prisma = new PrismaClient();
const row = await prisma.autonomiseWebhookIngest.findFirst({
  where: { vendorEventId: eventId },
  select: { payload: true },
});
console.log("\n--- webhook payload ---");
console.log(JSON.stringify(row?.payload, null, 2));
await prisma.$disconnect();
