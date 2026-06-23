import type { PrismaClient } from "@prisma/client";
import type { AutonomiseIngestResult } from "@/lib/integrations/autonomise-ingest";
import { resolveAndPersistAutonomiseIdentity } from "@/lib/integrations/autonomise-identity-resolver";
import { resolveAutonomiseMediaWithRetries } from "@/lib/integrations/autonomise-media-resolver";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";

/** Background work after webhook row is saved — media retries + identity (does not block Autonomise). */
export async function runAutonomiseIngestFollowUp(
  prisma: PrismaClient,
  args: {
    kind: "event" | "media";
    payload: unknown;
    result: AutonomiseIngestResult;
  }
): Promise<void> {
  if (args.result.duplicate || !isAutonomiseApiConfigured()) return;

  const fields = extractAutonomiseFields(args.payload, args.kind);
  const eventId =
    fields.vendorEventId ??
    args.result.linkedEventId ??
    fields.linkedEventId;

  if (!eventId) return;

  const shouldFetchMedia =
    (args.kind === "event" && args.result.accepted) || args.kind === "media";

  if (shouldFetchMedia && !args.result.mediaUrl) {
    await resolveAutonomiseMediaWithRetries(prisma, {
      eventId,
      payload: args.payload,
    });
  }

  if (
    args.kind === "event" &&
    args.result.accepted &&
    args.result.id &&
    (!args.result.vehicleRego || !args.result.driverName)
  ) {
    try {
      await resolveAndPersistAutonomiseIdentity(prisma, {
        ingestId: args.result.id,
        payload: args.payload,
      });
    } catch (e) {
      console.warn(
        "[autonomise-ingest] identity fetch failed",
        args.result.id,
        e instanceof Error ? e.message : e
      );
    }
  }
}
