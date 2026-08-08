/**
 * Upload an already-encrypted Neon pg_dump archive to Cloudflare R2.
 * Dump + encrypt happen in the GitHub Action (pg_dump -Fc + OpenSSL); this script only uploads.
 *
 * Required env:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   BACKUP_FILE_PATH — local path to *.dump.enc
 * Optional:
 *   R2_OBJECT_KEY — override object key (default: backups/<basename>)
 *
 * @see app-next/docs/ops/db-backup-restore.md
 * @see app-next/docs/product/hot-cold-record-access-project-scope.md
 */

import { createReadStream, statSync } from "node:fs";
import { basename } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requireEnv("R2_BUCKET_NAME");
  const filePath = requireEnv("BACKUP_FILE_PATH");

  const stats = statSync(filePath);
  if (!stats.isFile() || stats.size <= 0) {
    throw new Error(`BACKUP_FILE_PATH is missing or empty: ${filePath}`);
  }

  const objectKey =
    process.env.R2_OBJECT_KEY?.trim() || `backups/${basename(filePath)}`;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log(
    JSON.stringify({
      event: "r2_upload_start",
      bucket,
      objectKey,
      bytes: stats.size,
    })
  );

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: createReadStream(filePath),
      ContentType: "application/octet-stream",
      ContentLength: stats.size,
      Metadata: {
        "circadia-artefact": "neon-pg-dump-fc-encrypted",
        "circadia-sor": "electronic-data-plus-signature",
      },
    })
  );

  console.log(
    JSON.stringify({
      event: "r2_upload_ok",
      bucket,
      objectKey,
      bytes: stats.size,
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
