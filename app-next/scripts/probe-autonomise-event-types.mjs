import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
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
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.production.local");
loadEnvFile(
  `${process.env.USERPROFILE ?? ""}/OneDrive/Documents/autonomise-fleet-alerts/backend/.env`
);

const clientId = (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim();
const primaryKey = process.env.AUTONOMISE_PRIMARY_KEY ?? "";
const baseUrl = "https://api.autonomise.ai";

async function token() {
  const res = await fetch("https://login.autonomise.ai/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: primaryKey,
      scope: "vt.api",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function probe(path) {
  const t = await token();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${t}`,
      Accept: "application/json",
      "X-Client-Id": clientId,
    },
  });
  const text = await res.text();
  console.log("\n===", path, res.status, "===");
  console.log(text.slice(0, 3000));
}

const paths = [
  "/eventtypes",
  "/event-types",
  "/v1/eventtypes",
  "/v1/event-types",
  "/organisation/2bd17364-739f-f011-8e62-6045bdfcbf17/eventtypes",
  "/organisation/2bd17364-739f-f011-8e62-6045bdfcbf17/event-types",
  "/fleet/9afc8885-739f-f011-8e62-6045bdfcbf17/eventtypes",
];

for (const p of paths) {
  try {
    await probe(p);
  } catch (e) {
    console.log("ERR", p, e);
  }
}
