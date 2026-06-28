import type { PrismaClient } from "@prisma/client";
import type { AutonomiseIngestResult } from "@/lib/integrations/autonomise-ingest";
import { maybeBridgeAutonomiseEventFromIngest } from "@/lib/integrations/autonomise-block-bridge";
import { maybePromoteAutonomiseToCommandLifecycle } from "@/lib/integrations/command-lifecycle-bridge";
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

  if (isAutonomiseApiConfigured() && !args.result.mediaUrl) {
    const fields = extractAutonomiseFields(args.payload, args.kind);
    const eventId =
      fields.vendorEventId ??
      args.result.linkedEventId ??
      fields.linkedEventId;

    const shouldFetchMedia =
      Boolean(eventId) &&
      ((args.kind === "event" && args.result.accepted) || args.kind === "media");

    if (shouldFetchMedia && eventId) {
      await resolveAutonomiseMediaWithRetries(prisma, {
        eventId,
        payload: args.payload,
      });
    }
  }

  if (args.kind === "event") {
    try {
      const latest = await prisma.autonomiseWebhookIngest.findUnique({
        where: { id: args.result.id },
        select: {
          id: true,
          vendorAlarmId: true,
          vehicleRego: true,
          driverName: true,
          mediaUrl: true,
          payload: true,
        },
      });
      if (latest) {
        const lifecycle = await maybePromoteAutonomiseToCommandLifecycle(prisma, {
          ingestId: latest.id,
          vendorAlarmId: latest.vendorAlarmId,
          vehicleRego: latest.vehicleRego,
          driverName: latest.driverName,
          mediaUrl: latest.mediaUrl,
          payload: latest.payload ?? args.payload,
        });
        if (lifecycle.promoted) {
          console.info("[command-lifecycle-bridge] promoted", latest.id, lifecycle.eventId);
        } else if (lifecycle.mediaUpdated) {
          console.info("[command-lifecycle-bridge] media updated", latest.id);
        } else if (lifecycle.skippedReason && lifecycle.skippedReason !== "already_promoted") {
          console.info("[command-lifecycle-bridge] skipped", latest.id, lifecycle.skippedReason);
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
}
