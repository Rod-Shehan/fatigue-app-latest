import type { PrismaClient } from "@prisma/client";
import {
  syncCommandLifecycleForVendorEventId,
  syncCommandLifecycleFromEventIngest,
} from "@/lib/integrations/command-lifecycle-bridge";
import type { AutonomiseIngestResult } from "@/lib/integrations/autonomise-ingest";
import { maybeBridgeAutonomiseEventFromIngest } from "@/lib/integrations/autonomise-block-bridge";
import { resolveAutonomiseMediaWithRetries } from "@/lib/integrations/autonomise-media-resolver";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";

async function logCommandLifecycleSync(
  ingestId: string,
  lifecycle: Awaited<ReturnType<typeof syncCommandLifecycleFromEventIngest>>
): Promise<void> {
  if (lifecycle.promoted) {
    console.info("[command-lifecycle-bridge] promoted", ingestId, lifecycle.eventId);
  } else if (lifecycle.mediaUpdated) {
    console.info("[command-lifecycle-bridge] media updated", ingestId);
  } else if (lifecycle.skippedReason && lifecycle.skippedReason !== "already_promoted") {
    console.info("[command-lifecycle-bridge] skipped", ingestId, lifecycle.skippedReason);
  }
}

/** Background clip retries when sync ingest fetch ran too early (Vercel after() — keep delays short). */
export async function runAutonomiseIngestFollowUp(
  prisma: PrismaClient,
  args: {
    kind: "event" | "media";
    payload: unknown;
    result: AutonomiseIngestResult;
  }
): Promise<void> {
  if (args.result.duplicate || !args.result.accepted || !args.result.id) return;

  if (args.kind === "event") {
    try {
      const bridge = await maybeBridgeAutonomiseEventFromIngest(prisma, {
        ingestId: args.result.id,
        vendorAlarmId: args.result.vendorAlarmId,
        vehicleRego: args.result.vehicleRego,
        payload: args.payload,
      });
      if (!bridge.bridged && bridge.skippedReason) {
        console.info("[autonomise-block-bridge] skipped", args.result.id, bridge.skippedReason);
      }
    } catch (e) {
      console.warn(
        "[autonomise-block-bridge] failed",
        args.result.id,
        e instanceof Error ? e.message : e
      );
    }
  }

  const fields = extractAutonomiseFields(args.payload, args.kind);
  const vendorEventId =
    fields.vendorEventId ?? args.result.linkedEventId ?? fields.linkedEventId ?? null;

  if (isAutonomiseApiConfigured() && !args.result.mediaUrl) {
    const shouldFetchMedia =
      Boolean(vendorEventId) &&
      ((args.kind === "event" && args.result.accepted) || args.kind === "media");

    if (shouldFetchMedia && vendorEventId) {
      await resolveAutonomiseMediaWithRetries(prisma, {
        eventId: vendorEventId,
        payload: args.payload,
      });
    }
  }

  try {
    if (args.kind === "event") {
      const lifecycle = await syncCommandLifecycleFromEventIngest(prisma, args.result.id);
      await logCommandLifecycleSync(args.result.id, lifecycle);
    } else if (vendorEventId) {
      const lifecycle = await syncCommandLifecycleForVendorEventId(prisma, vendorEventId);
      if (lifecycle.mediaUpdated || lifecycle.promoted) {
        console.info("[command-lifecycle-bridge] media webhook sync", vendorEventId);
      }
    }
  } catch (e) {
    console.warn(
      "[command-lifecycle-bridge] failed",
      args.result.id,
      e instanceof Error ? e.message : e
    );
  }
}
