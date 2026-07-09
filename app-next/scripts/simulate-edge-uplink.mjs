#!/usr/bin/env node
/**
 * Mock edge uplink for Manager development without Pi hardware.
 * POSTs golden fixtures to edge APIs when implemented; for now validates locally.
 *
 * Usage (from repo root):
 *   node app-next/scripts/simulate-edge-uplink.mjs
 *   node app-next/scripts/simulate-edge-uplink.mjs --fixture drift
 *
 * Future: --url https://staging.circadia24.com --token ...
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = path.join(ROOT, "docs/architecture/schemas/fixtures");

const FIXTURE_MAP = {
  normal: "camera-block-v2-normal.json",
  drift: "camera-block-v2-drift-anomaly.json",
  suspect: "camera-block-v2-suspect-pre-fatigue.json",
  tunneling: "camera-block-v2-cognitive-tunneling.json",
  session: "edge-session-init-v1-acknowledged.json",
  capsule: "evidence-capsule-v1-drift-anomaly.json",
  silent: "evidence-capsule-v1-silent-observation.json",
};

const arg = process.argv.find((a) => a.startsWith("--fixture="));
const key = arg ? arg.split("=")[1] : "normal";
const file = FIXTURE_MAP[key];

if (!file) {
  console.error(`Unknown fixture key: ${key}. Use: ${Object.keys(FIXTURE_MAP).join(", ")}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), "utf8"));
console.log(`Loaded fixture: ${file}`);
console.log(JSON.stringify(payload, null, 2));

console.log("\nValidating via circadia-contracts...");
const validate = spawnSync("node", ["scripts/validate-circadia-contracts.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});

if (validate.status !== 0) process.exit(validate.status ?? 1);

console.log("\nNote: Edge HTTP routes (/api/edge/v1/*) are not wired yet.");
console.log("When ready, extend this script to POST payloads to staging.");
