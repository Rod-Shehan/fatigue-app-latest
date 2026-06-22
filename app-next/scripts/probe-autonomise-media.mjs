/**
 * One-off diagnostic: probe Autonomise media API paths (status codes only).
 * Usage: node scripts/probe-autonomise-media.mjs
 * Reads AUTONOMISE_* from autonomise-fleet-alerts backend/.env if not in process.env.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fleetEnv = join(
  process.env.USERPROFILE ?? "",
  "OneDrive",
  "Documents",
  "autonomise-fleet-alerts",
  "backend",
  ".env"
);

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].trim();
  }
}

loadEnvFile(fleetEnv);

const clientId = (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim();
const primaryKey = (process.env.AUTONOMISE_PRIMARY_KEY ?? "").trim();
const baseUrl = (process.env.AUTONOMISE_API_BASE_URL ?? "https://api.autonomise.ai").replace(/\/$/, "");
const authMode = (process.env.AUTONOMISE_AUTH_MODE ?? "bearer").toLowerCase();

const EVENT_ID = "a72e581d-3c0d-4240-b093-905af32562a5";
const FNOL_SLUG = "MDBkMjA1NzRlYnxhNzJlNTgxZC0zYzBkLTQyNDAtYjA5My05MDVhZjMyNTYyYTU=";

const TEMPLATES = [
  "/event/{eventId}/media?clientId={clientId}",
  "/events/{eventId}/media?clientId={clientId}",
  "/v1/events/{eventId}/media?clientId={clientId}",
  "/v1/event/{eventId}/media?clientId={clientId}",
  "/api/v1/events/{eventId}/media?clientId={clientId}",
  "/fnol/{eventId}/media?clientId={clientId}",
];

function authHeaders(token, mode) {
  if (mode === "api-key") return { "X-API-Key": token };
  if (mode === "x-custom") return { "X-Autonomise-Token": token };
  return { Authorization: `Bearer ${token}` };
}

function applyTemplate(template, eventId) {
  return template
    .replace("{eventId}", encodeURIComponent(eventId))
    .replace("{clientId}", encodeURIComponent(clientId));
}

async function probe(path, mode) {
  const url = `${baseUrl}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        ...authHeaders(primaryKey, mode),
        Accept: "application/json",
        "X-Client-Id": clientId,
      },
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    const hasHttpUrl = /https?:\/\//i.test(text);
    const hasVideoExt = /\.(mp4|webm|m3u8)/i.test(text);
    return {
      status: res.status,
      ok: res.ok,
      bodyLen: text.length,
      hasHttpUrl,
      hasVideoExt,
      preview: text.slice(0, 120).replace(/\s+/g, " "),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

if (!primaryKey) {
  console.error("No AUTONOMISE_PRIMARY_KEY found");
  process.exit(1);
}

console.log("probing event", EVENT_ID, "base", baseUrl, "auth", authMode);
console.log("--- UUID lookups ---");
for (const template of TEMPLATES) {
  const path = applyTemplate(template, EVENT_ID);
  const r = await probe(path, authMode);
  console.log(path, r);
  if (r.ok && r.hasHttpUrl) break;
}

console.log("--- FNOL slug lookups ---");
for (const template of TEMPLATES.slice(0, 4)) {
  const path = applyTemplate(template, FNOL_SLUG);
  const r = await probe(path, authMode);
  console.log(path.slice(0, 80) + "...", r);
  if (r.ok && r.hasHttpUrl) break;
}

console.log("--- auth mode sweep (first path only) ---");
const firstPath = applyTemplate(TEMPLATES[2], EVENT_ID);
for (const mode of ["bearer", "api-key", "x-custom"]) {
  const r = await probe(firstPath, mode);
  console.log(mode, r.status ?? r.error);
}
