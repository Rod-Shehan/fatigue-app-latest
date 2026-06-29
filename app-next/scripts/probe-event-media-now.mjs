/**
 * Probe Autonomise media API for a stored event (OAuth device path + fallbacks).
 * Usage: node scripts/probe-event-media-now.mjs [vendorEventId]
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[m[1].trim()] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.local");

const clientId = (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim();
const primaryKey = (process.env.AUTONOMISE_PRIMARY_KEY ?? "").trim();
const baseUrl = (process.env.AUTONOMISE_API_BASE_URL ?? "https://api.autonomise.ai").replace(/\/$/, "");

async function oauthToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: primaryKey,
    scope: "vt.api",
  });
  const res = await fetch("https://login.autonomise.ai/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  if (!res.ok) return { error: `oauth ${res.status}`, body: text.slice(0, 200) };
  const data = JSON.parse(text);
  return { token: data.access_token?.slice(0, 20) + "...", full: data.access_token };
}

async function getMedia(path, token) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  return {
    path,
    status: res.status,
    len: text.length,
    hasVideoUrl: /video\.autonomise\.ai.*\.mp4/i.test(text),
    preview: text.slice(0, 200).replace(/\s+/g, " "),
  };
}

const prisma = new PrismaClient();
const eventIdArg = process.argv[2];

const eventRow = eventIdArg
  ? await prisma.autonomiseWebhookIngest.findFirst({
      where: { kind: "event", vendorEventId: eventIdArg },
      select: { vendorEventId: true, mediaUrl: true, payload: true, vendorAlarmId: true, accepted: true },
    })
  : await prisma.autonomiseWebhookIngest.findFirst({
      where: {
        kind: "event",
        accepted: true,
        vendorAlarmId: "VT3600AI_ALARM_DSM_Fatigue",
        mediaUrl: null,
        receivedAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      orderBy: { receivedAt: "desc" },
      select: { vendorEventId: true, mediaUrl: true, payload: true, vendorAlarmId: true, accepted: true },
    });

if (!eventRow?.vendorEventId) {
  console.log("No event row found");
  process.exit(1);
}

const eventId = eventRow.vendorEventId;
const deviceId = eventRow.payload?.device?.hardwareId ?? "";
const fnol = typeof eventRow.payload?.id === "string" ? eventRow.payload.id : "";

console.log({
  eventId,
  deviceId,
  alarm: eventRow.vendorAlarmId,
  storedMediaUrl: eventRow.mediaUrl ? "yes" : "NO",
  fnolPrefix: fnol.slice(0, 24) + "...",
});

if (!primaryKey) {
  console.error("AUTONOMISE_PRIMARY_KEY missing");
  process.exit(1);
}

const oauth = await oauthToken();
console.log("oauth", oauth.error ? oauth : { ok: true, token: oauth.token });

if (!oauth.full) process.exit(1);

console.log("\n--- device path (documented) ---");
console.log(await getMedia(`/device/${deviceId}/event/${eventId}/media`, oauth.full));

console.log("\n--- UUID event media path ---");
console.log(
  await getMedia(`/event/${eventId}/media?clientId=${encodeURIComponent(clientId)}`, oauth.full)
);

await prisma.$disconnect();
