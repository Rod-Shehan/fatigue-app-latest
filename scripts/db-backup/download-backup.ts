/**
 * Download one encrypted backup object from R2.
 *
 * Env:
 *   R2_* (account, keys, bucket)
 *   R2_OBJECT_KEY — e.g. backups/2026-08-08_03-21-32.dump.enc
 *   DOWNLOAD_PATH — local destination (default: ./work/<basename>)
 */

import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createR2Client, requireEnv } from "./r2-client.js";

async function main(): Promise<void> {
  const { client, bucket } = createR2Client();
  const objectKey = requireEnv("R2_OBJECT_KEY");
  const downloadPath =
    process.env.DOWNLOAD_PATH?.trim() || join("work", basename(objectKey));

  await mkdir(dirname(downloadPath), { recursive: true });

  const out = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );

  if (!out.Body) {
    throw new Error(`Empty body for s3://${bucket}/${objectKey}`);
  }

  // AWS SDK v3 Body is a Readable in Node
  await pipeline(out.Body as NodeJS.ReadableStream, createWriteStream(downloadPath));

  console.log(
    JSON.stringify({
      event: "r2_download_ok",
      bucket,
      objectKey,
      downloadPath,
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
