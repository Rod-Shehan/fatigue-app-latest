/**
 * Decrypt an OpenSSL AES-256-CBC (PBKDF2) backup produced by the GitHub Action.
 *
 * Env:
 *   BACKUP_ENCRYPTION_KEY
 *   ENC_PATH — path to *.dump.enc
 *   DUMP_PATH — optional output (default: ENC_PATH with .enc stripped)
 *
 * Requires openssl on PATH.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { requireEnv } from "./r2-client.js";

async function main(): Promise<void> {
  const key = requireEnv("BACKUP_ENCRYPTION_KEY");
  const encPath = requireEnv("ENC_PATH");
  if (!existsSync(encPath)) {
    throw new Error(`ENC_PATH not found: ${encPath}`);
  }

  const dumpPath =
    process.env.DUMP_PATH?.trim() ||
    (encPath.endsWith(".enc") ? encPath.slice(0, -4) : `${encPath}.dump`);

  const result = spawnSync(
    "openssl",
    [
      "enc",
      "-d",
      "-aes-256-cbc",
      "-pbkdf2",
      "-salt",
      "-in",
      encPath,
      "-out",
      dumpPath,
      "-pass",
      "env:BACKUP_ENCRYPTION_KEY",
    ],
    {
      env: { ...process.env, BACKUP_ENCRYPTION_KEY: key },
      encoding: "utf8",
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `openssl decrypt failed (exit ${result.status}): ${result.stderr || result.stdout || "unknown"}`
    );
  }

  console.log(
    JSON.stringify({
      event: "decrypt_ok",
      encPath,
      dumpPath,
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
