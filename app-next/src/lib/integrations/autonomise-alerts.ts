import type { AutonomiseWebhookIngest, Prisma, PrismaClient } from "@prisma/client";
import { evaluateAutonomiseEventAcceptance } from "@/lib/integrations/autonomise-event-evaluation";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";
import { getAutonomiseEventPresetFromEnv } from "@/lib/integrations/autonomise-webhook-auth";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import { backfillMissingAutonomiseMedia } from "@/lib/integrations/autonomise-media-resolver";
import { getCatalogueEntry, type FatigueEventPresetId } from "@/lib/integrations/fatigue-event-catalogue";

export type CameraAlertItem = {
  id: string;
  vendorEventId: string | null;
  vendorAlarmId: string | null;
  displayName: string | null;
  tier: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  receivedAt: string;
  accepted: boolean;
  rejectReason: string | null;
  mediaUrl: string | null;
  mediaPending: boolean;
  /** Media arrived but matching event webhook row is missing (Autonomise config). */
  eventWebhookPending?: boolean;
};

export type CameraAlertsDiagnostics = {
  ingestEvents: number;
  ingestEventsRejected: number;
  ingestMedia: number;
  mediaWithoutMatchingEvent: number;
  apiConfigured: boolean;
};

type IngestRow = Pick<
  AutonomiseWebhookIngest,
  | "id"
  | "kind"
  | "vendorAlarmId"
  | "vendorEventId"
  | "vehicleRego"
  | "driverName"
  | "linkedEventId"
  | "mediaUrl"
  | "accepted"
  | "rejectReason"
  | "receivedAt"
> & { payload?: Prisma.JsonValue };

function enrichMediaRow(row: IngestRow): IngestRow {
  if (!row.payload) return row;
  const fields = extractAutonomiseFields(row.payload, "media");
  return {
    ...row,
    vendorEventId: fields.vendorEventId ?? row.vendorEventId,
    linkedEventId: fields.linkedEventId ?? row.linkedEventId,
    mediaUrl: fields.mediaUrl ?? row.mediaUrl,
    vehicleRego: fields.vehicleRego ?? row.vehicleRego,
    driverName: fields.driverName ?? row.driverName,
  };
}

/** Re-evaluate stored event rows when mapper improves (e.g. new eventTypes codes). */
function enrichEventRow(row: IngestRow, preset: FatigueEventPresetId): IngestRow {
  if (!row.payload) return row;
  const fields = extractAutonomiseFields(row.payload, "event");
  const vendorAlarmId = fields.vendorAlarmId ?? row.vendorAlarmId;
  const { accepted, rejectReason } = evaluateAutonomiseEventAcceptance(vendorAlarmId, preset);
  return {
    ...row,
    vendorAlarmId,
    vendorEventId: fields.vendorEventId ?? row.vendorEventId,
    linkedEventId: fields.linkedEventId ?? row.linkedEventId,
    vehicleRego: fields.vehicleRego ?? row.vehicleRego,
    driverName: fields.driverName ?? row.driverName,
    accepted,
    rejectReason,
  };
}

export function buildCameraAlertsFromRows(
  events: IngestRow[],
  mediaRows: IngestRow[],
  eventKeysForMediaMatch?: Iterable<string | null | undefined>
): CameraAlertItem[] {
  const enrichedMedia = mediaRows.map(enrichMediaRow);
  const mediaByEventKey = new Map<string, string>();
  for (const row of enrichedMedia) {
    if (!row.mediaUrl) continue;
    const keys = [row.linkedEventId, row.vendorEventId].filter(Boolean) as string[];
    for (const key of keys) {
      if (!mediaByEventKey.has(key)) mediaByEventKey.set(key, row.mediaUrl);
    }
  }

  const eventAlerts: CameraAlertItem[] = events.map((event) => {
    const entry = event.vendorAlarmId ? getCatalogueEntry(event.vendorAlarmId) : undefined;
    const eventKey = event.vendorEventId;
    const mediaUrl = eventKey
      ? mediaByEventKey.get(eventKey) ?? event.mediaUrl ?? null
      : null;

    return {
      id: event.id,
      vendorEventId: event.vendorEventId,
      vendorAlarmId: event.vendorAlarmId,
      displayName: entry?.displayName ?? event.vendorAlarmId,
      tier: entry?.tier ?? null,
      vehicleRego: event.vehicleRego,
      driverName: event.driverName,
      receivedAt: event.receivedAt.toISOString(),
      accepted: event.accepted,
      rejectReason: event.rejectReason,
      mediaUrl,
      mediaPending: event.accepted && !mediaUrl,
    };
  });

  const eventKeys = new Set(
    eventKeysForMediaMatch
      ? [...eventKeysForMediaMatch].filter((id): id is string => Boolean(id))
      : events.map((e) => e.vendorEventId).filter((id): id is string => Boolean(id))
  );

  const orphanMediaAlerts: CameraAlertItem[] = [];
  for (const row of enrichedMedia) {
    const eventKey = row.linkedEventId ?? row.vendorEventId;
    if (!eventKey || eventKeys.has(eventKey)) continue;
    orphanMediaAlerts.push({
      id: row.id,
      vendorEventId: eventKey,
      vendorAlarmId: null,
      displayName: "Camera event (media only)",
      tier: null,
      vehicleRego: row.vehicleRego,
      driverName: row.driverName,
      receivedAt: row.receivedAt.toISOString(),
      accepted: false,
      rejectReason: "event_webhook_missing",
      mediaUrl: row.mediaUrl,
      mediaPending: false,
      eventWebhookPending: true,
    });
  }

  return [...eventAlerts, ...orphanMediaAlerts].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
}

export async function listCameraAlerts(
  prisma: PrismaClient,
  args: { limit?: number; hours?: number; acceptedOnly?: boolean }
): Promise<{
  alerts: CameraAlertItem[];
  configured: boolean;
  diagnostics: CameraAlertsDiagnostics;
}> {
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 100);
  const hours = args.hours ?? 48;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const preset = getAutonomiseEventPresetFromEnv();

  const [allEventRows, mediaRows, ingestEvents, ingestMedia] = await Promise.all([
    prisma.autonomiseWebhookIngest.findMany({
      where: { kind: "event", receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
      take: limit,
      select: {
        id: true,
        kind: true,
        vendorAlarmId: true,
        vendorEventId: true,
        vehicleRego: true,
        driverName: true,
        linkedEventId: true,
        mediaUrl: true,
        accepted: true,
        rejectReason: true,
        receivedAt: true,
        payload: true,
      },
    }),
    prisma.autonomiseWebhookIngest.findMany({
      where: { kind: "media", receivedAt: { gte: since } },
      orderBy: { receivedAt: "desc" },
      take: limit * 3,
      select: {
        id: true,
        kind: true,
        vendorAlarmId: true,
        vendorEventId: true,
        vehicleRego: true,
        driverName: true,
        linkedEventId: true,
        mediaUrl: true,
        accepted: true,
        rejectReason: true,
        receivedAt: true,
        payload: true,
      },
    }),
    prisma.autonomiseWebhookIngest.count({ where: { kind: "event", receivedAt: { gte: since } } }),
    prisma.autonomiseWebhookIngest.count({ where: { kind: "media", receivedAt: { gte: since } } }),
  ]);

  const enrichedEvents = allEventRows.map((row) => enrichEventRow(row, preset));
  const ingestEventsRejected = enrichedEvents.filter((row) => !row.accepted).length;

  await backfillMissingAutonomiseMedia(prisma, enrichedEvents);

  for (const row of mediaRows) {
    const eventId = enrichedEvents.find(
      (e) => e.vendorEventId && (e.vendorEventId === row.linkedEventId || e.vendorEventId === row.vendorEventId)
    );
    if (eventId?.mediaUrl && !row.mediaUrl) row.mediaUrl = eventId.mediaUrl;
  }

  const displayEvents = args.acceptedOnly
    ? enrichedEvents.filter((row) => row.accepted)
    : enrichedEvents;
  const matchEventKeys = enrichedEvents.map((row) => row.vendorEventId);

  const alerts = buildCameraAlertsFromRows(displayEvents, mediaRows, matchEventKeys);
  const mediaWithoutMatchingEvent = alerts.filter((a) => a.eventWebhookPending).length;

  const configured = Boolean(process.env.AUTONOMISE_WEBHOOK_SECRET?.trim());
  const apiConfigured = isAutonomiseApiConfigured();

  const visibleAlerts = args.acceptedOnly
    ? alerts.filter((a) => a.accepted || a.eventWebhookPending)
    : alerts;

  return {
    alerts: visibleAlerts,
    configured,
    diagnostics: {
      ingestEvents,
      ingestEventsRejected,
      ingestMedia,
      mediaWithoutMatchingEvent,
      apiConfigured,
    },
  };
}
