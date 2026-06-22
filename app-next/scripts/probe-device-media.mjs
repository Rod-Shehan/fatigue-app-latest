import { readFileSync } from "node:fs";
import { join } from "node:path";

const envPath = join(
  process.env.USERPROFILE ?? "",
  "OneDrive",
  "Documents",
  "autonomise-fleet-alerts",
  "backend",
  ".env"
);
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const key = process.env.AUTONOMISE_PRIMARY_KEY ?? "";
const clientId = process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7";
const deviceId = "00d20574eb";
const eventId = "a72e581d-3c0d-4240-b093-905af32562a5";
const path = `/device/${encodeURIComponent(deviceId)}/event/${encodeURIComponent(eventId)}/media`;
const url = `https://api.autonomise.ai${path}`;

for (const mode of ["api-key", "bearer"]) {
  const headers =
    mode === "api-key"
      ? { "X-API-Key": key, Accept: "application/json", "X-Client-Id": clientId }
      : { Authorization: `Bearer ${key}`, Accept: "application/json", "X-Client-Id": clientId };
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  console.log(mode, res.status, text.slice(0, 300));
}
