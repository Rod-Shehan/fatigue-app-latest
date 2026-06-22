import type { PrismaClient } from "@prisma/client";
import {
  fetchAutonomiseEventMediaBundle,
  isAutonomiseApiConfigured,
} from "@/lib/integrations/autonomise-api-client";
import { parseFnolReference, extractDeviceHardwareId } from "@/lib/integrations/autonomise-payload";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function fnolSlugFromPayload(payload: unknown): string {
  if (!isRecord(payload)) return "";
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  return id ? parseFnolReference(id).fnolSlug : "";
}

export type ResolveAutonomiseMediaResult = {
  eventId: string;
  mediaUrl: string | null;
  driverName: string | null;
  fetched: boolean;
};

export function deviceHardwareIdFromPayload(payload: unknown): string {
  return extractDeviceHardwareId(payload) ?? "";
}

/** Pull clip/snapshots from Autonomise API and persist on matching ingest rows. */
export async function resolveAndPersistAutonomiseMedia(
  prisma: PrismaClient,
  args: { eventId: string; fnolSlug?: string; deviceHardwareId?: string; payload?: unknown }
): Promise<ResolveAutonomiseMediaResult | null> {
  const eventId = String(args.eventId || "").trim();
  if (!eventId || !isAutonomiseApiConfigured()) return null;

  const fnolSlug = args.fnolSlug ?? fnolSlugFromPayload(args.payload) ?? "";
  const deviceHardwareId =
    args.deviceHardwareId?.trim() || deviceHardwareIdFromPayload(args.payload) || "";

  const bundle = await fetchAutonomiseEventMediaBundle(eventId, { fnolSlug, deviceHardwareId });
  if (!bundle.mediaUrl && !bundle.driverName) {
    return { eventId, mediaUrl: null, driverName: null, fetched: true };
  }

  const patch: { mediaUrl?: string; driverName?: string } = {};
  if (bundle.mediaUrl) patch.mediaUrl = bundle.mediaUrl;
  if (bundle.driverName) patch.driverName = bundle.driverName;

  await prisma.autonomiseWebhookIngest.updateMany({
    where: {
      OR: [{ vendorEventId: eventId }, { linkedEventId: eventId }],
    },
    data: patch,
  });

  return {
    eventId,
    mediaUrl: bundle.mediaUrl,
    driverName: bundle.driverName || null,
    fetched: true,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delays before each media API attempt — clip is often not ready on first event webhook. */
export const MEDIA_FETCH_RETRY_DELAYS_MS = [0, 45_000, 90_000, 180_000] as const;

async function eventIngestHasMediaUrl(
  prisma: PrismaClient,
  eventId: string
): Promise<string | null> {
  const row = await prisma.autonomiseWebhookIngest.findFirst({
    where: {
      kind: "event",
      OR: [{ vendorEventId: eventId }, { linkedEventId: eventId }],
      mediaUrl: { not: null },
    },
    select: { mediaUrl: true },
  });
  return row?.mediaUrl ?? null;
}

/**
 * Retry Autonomise media API until clip is ready (background follow-up after webhook).
 * Clips exist on Autonomise before our single ingest attempt; retries close that gap.
 */
export async function resolveAutonomiseMediaWithRetries(
  prisma: PrismaClient,
  args: { eventId: string; payload?: unknown }
): Promise<ResolveAutonomiseMediaResult | null> {
  const eventId = String(args.eventId || "").trim();
  if (!eventId || !isAutonomiseApiConfigured()) return null;

  for (const delayMs of MEDIA_FETCH_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);

    const existing = await eventIngestHasMediaUrl(prisma, eventId);
    if (existing) {
      return { eventId, mediaUrl: existing, driverName: null, fetched: false };
    }

    try {
      const result = await resolveAndPersistAutonomiseMedia(prisma, {
        eventId,
        payload: args.payload,
      });
      if (result?.mediaUrl) return result;
    } catch (e) {
      console.warn(
        "[autonomise-media] retry fetch failed",
        eventId,
        e instanceof Error ? e.message : e
      );
    }
  }

  return { eventId, mediaUrl: null, driverName: null, fetched: true };
}

const MAX_FETCH_PER_REQUEST = 3;

/** Backfill media for accepted events missing a clip URL (Live alerts poll). Mutates rows in place. */
export async function backfillMissingAutonomiseMedia(
  prisma: PrismaClient,
  events: Array<{
    vendorEventId: string | null;
    linkedEventId?: string | null;
    mediaUrl: string | null;
    driverName?: string | null;
    accepted?: boolean;
    payload?: unknown;
  }>
): Promise<number> {
  if (!isAutonomiseApiConfigured()) return 0;

  let fetches = 0;
  for (const event of events) {
    if (fetches >= MAX_FETCH_PER_REQUEST) break;
    if (!event.accepted || !event.vendorEventId || event.mediaUrl) continue;

    fetches += 1;
    try {
      const result = await resolveAndPersistAutonomiseMedia(prisma, {
        eventId: event.vendorEventId,
        payload: event.payload,
      });
      if (result?.mediaUrl) event.mediaUrl = result.mediaUrl;
      if (result?.driverName && !event.driverName) event.driverName = result.driverName;
    } catch (e) {
      console.warn(
        "[autonomise-media] backfill failed",
        event.vendorEventId,
        e instanceof Error ? e.message : e
      );
    }
  }
  return fetches;
}
