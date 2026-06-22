import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnvFile(".env.production.local");
if (!process.env.AUTONOMISE_PRIMARY_KEY) {
  const fleetEnv = `${process.env.USERPROFILE ?? ""}/OneDrive/Documents/autonomise-fleet-alerts/backend/.env`;
  try {
    loadEnvFile(fleetEnv);
  } catch {
    /* optional fallback */
  }
}

const clientId = (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim();
const primaryKey = process.env.AUTONOMISE_PRIMARY_KEY ?? "";
const baseUrl = (process.env.AUTONOMISE_API_BASE_URL ?? "https://api.autonomise.ai").replace(/\/$/, "");

const deviceId = "00d20574eb";
const eventId = "6b52fb2f-7b45-47e6-8429-013f8d2706d2";
const vehicleId = "e82f7ba8-759f-f011-8e62-6045bdfcbf17";
const fnolSlug =
  "MDBkMjA1NzRlYnw2YjUyZmIyZi03YjQ1LTQ3ZTYtODQyOS0wMTNmOGQyNzA2ZDI=";

async function getToken() {
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
  });
  const data = await res.json();
  return data.access_token;
}

async function probe(path) {
  const token = await getToken();
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "X-Client-Id": clientId,
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  console.log("\n===", path, res.status, "===");
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 4000));
  } catch {
    console.log(text.slice(0, 500));
  }
}

const paths = [
  `/device/${deviceId}/event/${eventId}/media`,
  `/device/${deviceId}`,
  `/devices/${deviceId}`,
  `/v1/devices/${deviceId}`,
  `/vehicle/${vehicleId}`,
  `/vehicles/${vehicleId}`,
  `/v1/vehicles/${vehicleId}`,
  `/v1/events/${eventId}?clientId=${encodeURIComponent(clientId)}`,
  `/events/${eventId}?clientId=${encodeURIComponent(clientId)}`,
  `/v1/event/${eventId}?clientId=${encodeURIComponent(clientId)}`,
  `/fnol/${encodeURIComponent(fnolSlug)}?clientId=${encodeURIComponent(clientId)}`,
];

for (const path of paths) {
  try {
    await probe(path);
  } catch (e) {
    console.log("ERR", path, e);
  }
}
