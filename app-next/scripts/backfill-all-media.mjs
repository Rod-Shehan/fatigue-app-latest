/**
 * One-off: fetch clips for catalogue events missing mediaUrl (last 7 days).
 */
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

const clientId = (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim();
const primaryKey = process.env.AUTONOMISE_PRIMARY_KEY ?? "";
const baseUrl = "https://api.autonomise.ai";

if (!primaryKey) {
  console.error("AUTONOMISE_PRIMARY_KEY required");
  process.exit(1);
}

const prisma = new PrismaClient();
const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const rows = await prisma.autonomiseWebhookIngest.findMany({
  where: {
    kind: "event",
    mediaUrl: null,
    receivedAt: { gte: since },
    NOT: { vendorAlarmId: null },
  },
  orderBy: { receivedAt: "desc" },
  select: {
    vendorEventId: true,
    vendorAlarmId: true,
    payload: true,
  },
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

let updated = 0;
let empty = 0;

for (const row of rows) {
  if (!row.vendorEventId) continue;
  const deviceId = row.payload?.device?.hardwareId ?? "";
  if (!deviceId) continue;

  const res = await fetch(
    `${baseUrl}/device/${deviceId}/event/${row.vendorEventId}/media`,
    {
      headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    }
  );
  const text = await res.text();
  const match = text.match(/https:\/\/video\.autonomise\.ai[^"\\]+?\.mp4[^"\\]*/i);
  if (!match) {
    empty++;
    continue;
  }
  const mediaUrl = match[0];
  await prisma.autonomiseWebhookIngest.updateMany({
    where: {
      OR: [{ vendorEventId: row.vendorEventId }, { linkedEventId: row.vendorEventId }],
    },
    data: { mediaUrl },
  });
  updated++;
  console.log("clip", row.vendorAlarmId?.slice(-20), row.vendorEventId.slice(0, 8));
}

console.log(`Done: ${updated} updated, ${empty} still empty (of ${rows.length} tried)`);
await prisma.$disconnect();
