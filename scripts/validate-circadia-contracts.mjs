#!/usr/bin/env node
/**
 * Validate golden fixtures for Pi ↔ server contract parity.
 * Run from repo root: node scripts/validate-circadia-contracts.mjs
 *
 * Pi team: copy docs/architecture/schemas/ and run the same script.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = path.join(ROOT, "docs/architecture/schemas/fixtures");
const APP_NEXT = path.join(ROOT, "app-next");

function main() {
  const required = [
    "camera-block-v2-normal.json",
    "camera-block-v2-drift-anomaly.json",
    "camera-block-v2-suspect-pre-fatigue.json",
    "camera-block-v2-cognitive-tunneling.json",
    "edge-session-init-v1-acknowledged.json",
    "evidence-capsule-v1-drift-anomaly.json",
    "evidence-capsule-v1-silent-observation.json",
    "vault-ack-v1-success.json",
  ];

  for (const name of required) {
    const p = path.join(FIXTURES, name);
    if (!fs.existsSync(p)) {
      console.error(`Missing fixture: ${p}`);
      process.exit(1);
    }
    try {
      JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      console.error(`Invalid JSON in ${name}:`, err);
      process.exit(1);
    }
  }

  console.log(`OK: ${required.length} fixtures present and valid JSON`);

  const vitest = spawnSync(
    "npx",
    ["vitest", "run", "src/lib/circadia-contracts/circadia-contracts.test.ts"],
    { cwd: APP_NEXT, stdio: "inherit", shell: true }
  );

  if (vitest.status !== 0) {
    process.exit(vitest.status ?? 1);
  }

  console.log("OK: all contract validators passed");
}

main();
