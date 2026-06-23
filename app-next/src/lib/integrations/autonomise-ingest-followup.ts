import type { PrismaClient } from "@prisma/client";
import type { AutonomiseIngestResult } from "@/lib/integrations/autonomise-ingest";
import { resolveAutonomiseMediaWithRetries } from "@/lib/integrations/autonomise-media-resolver";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";

/** Background clip retries when sync ingest fetch ran too early (Vercel after() — keep delays short). */
export async function runAutonomiseIngestFollowUp(
  prisma: PrismaClient,
  args: {
    kind: "event" | "media";
    payload: unknown;
    result: AutonomiseIngestResult;
  }
): Promise<void> {
  if (args.result.duplicate || !isAutonomiseApiConfigured()) return;
  if (args.result.mediaUrl) return;

  const fields = extractAutonomiseFields(args.payload, args.kind);
  const eventId =
    fields.vendorEventId ??
    args.result.linkedEventId ??
    fields.linkedEventId;

  if (!eventId) return;

  const shouldFetchMedia =
    (args.kind === "event" && args.result.accepted) || args.kind === "media";

  if (!shouldFetchMedia) return;

  await resolveAutonomiseMediaWithRetries(prisma, {
    eventId,
    payload: args.payload,
  });
}
