/**
 * List encrypted Neon backups in R2 (prefix backups/).
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 */

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createR2Client } from "./r2-client.js";

async function main(): Promise<void> {
  const { client, bucket } = createR2Client();
  const prefix = process.env.R2_PREFIX?.trim() || "backups/";

  const keys: { key: string; size: number; lastModified: string | null }[] = [];
  let token: string | undefined;

  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of out.Contents ?? []) {
      if (!obj.Key) continue;
      keys.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified?.toISOString() ?? null,
      });
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);

  keys.sort((a, b) => a.key.localeCompare(b.key));
  console.log(JSON.stringify({ bucket, prefix, count: keys.length, objects: keys }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
