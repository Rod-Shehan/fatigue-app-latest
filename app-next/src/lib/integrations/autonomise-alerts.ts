import type { AutonomiseWebhookIngest, Prisma, PrismaClient } from "@prisma/client";
import { evaluateAutonomiseEventAcceptance } from "@/lib/integrations/autonomise-event-evaluation";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";
import { getEnabledAlarmIdSet } from "@/lib/integrations/camera-alert-event-settings";
import { isAutonomiseApiConfigured } from "@/lib/integrations/autonomise-api-client";
import { getAutonomiseWebhookSecretFromEnv } from "@/lib/integrations/autonomise-webhook-auth";
import { backfillMissingAutonomiseMedia, PENDING_INBOX_MAX_FETCH } from "@/lib/integrations/autonomise-media-resolver";
import { loadTriageByIngestIds } from "@/lib/integrations/camera-alert-triage";
import { getCatalogueEntry } from "@/lib/integrations/fatigue-event-catalogue";

export type CameraAlertTriageStatus = "pending" | "authorized" | "dismissed";

export type CameraAlertItem = {
  id: string;
  vendorEventId: string | null;
  vendorAlarmId: string | null;
  displayName: string | null;
  tier: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  deviceHardwareId: string | null;
  receivedAt: string;
  accepted: boolean;
  rejectReason: string | null;
  mediaUrl: string | null;
  mediaPending: boolean;
  triageStatus: CameraAlertTriageStatus;
  triageDecidedAt: string | null;
  triageDecidedBy: string | null;
  triageNote: string | null;
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
> & { payload?: Prisma.JsonValue; deviceHardwareId?: string | null };

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
    deviceHardwareId: fields.deviceHardwareId ?? row.deviceHardwareId ?? null,
  };
}

/** Re-evaluate stored event rows when mapper or tenant settings change. */
function enrichEventRow(row: IngestRow, enabledAlarmIds: ReadonlySet<string>): IngestRow {
  if (!row.payload) return row;
  const fields = extractAutonomiseFields(row.payload, "event");
  const vendorAlarmId = fields.vendorAlarmId ?? row.vendorAlarmId;
  const { accepted, rejectReason } = evaluateAutonomiseEventAcceptance(vendorAlarmId, enabledAlarmIds);
  return {
    ...row,
    vendorAlarmId,
    vendorEventId: fields.vendorEventId ?? row.vendorEventId,
    linkedEventId: fields.linkedEventId ?? row.linkedEventId,
    vehicleRego: fields.vehicleRego ?? row.vehicleRego,
    driverName: fields.driverName ?? row.driverName,
    deviceHardwareId: fields.deviceHardwareId ?? row.deviceHardwareId ?? null,
    accepted,
    rejectReason,
  };
}

function deviceHardwareIdFromRow(row: IngestRow, kind: "event" | "media"): string | null {
  if (row.deviceHardwareId) return row.deviceHardwareId;
  if (!row.payload) return null;
  return extractAutonomiseFields(row.payload, kind).deviceHardwareId;
}

export function buildCameraAlertsFromRows(
  events: IngestRow[],
  mediaRows: IngestRow[],
  eventKeysForMediaMatch?: Iterable<string | null | undefined>,
  triageByIngestId?: Map<
    string,
    {
      decision: string;
      note: string | null;
      decidedByEmail: string | null;
      decidedAt: Date;
    }
  >
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
    const triage = triageByIngestId?.get(event.id);
    const triageStatus: CameraAlertTriageStatus =
      triage?.decision === "authorized"
        ? "authorized"
        : triage?.decision === "dismissed"
          ? "dismissed"
          : "pending";

    return {
      id: event.id,
      vendorEventId: event.vendorEventId,
      vendorAlarmId: event.vendorAlarmId,
      displayName: entry?.displayName ?? event.vendorAlarmId,
      tier: entry?.tier ?? null,
      vehicleRego: event.vehicleRego,
      driverName: event.driverName,
      deviceHardwareId: deviceHardwareIdFromRow(event, "event"),
      receivedAt: event.receivedAt.toISOString(),
      accepted: event.accepted,
      rejectReason: event.rejectReason,
      mediaUrl,
      mediaPending: event.accepted && !mediaUrl,
      triageStatus,
      triageDecidedAt: triage?.decidedAt.toISOString() ?? null,
      triageDecidedBy: triage?.decidedByEmail ?? null,
      triageNote: triage?.note ?? null,
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
      deviceHardwareId: deviceHardwareIdFromRow(row, "media"),
      receivedAt: row.receivedAt.toISOString(),
      accepted: false,
      rejectReason: "event_webhook_missing",
      mediaUrl: row.mediaUrl,
      mediaPending: false,
      triageStatus: "pending",
      triageDecidedAt: null,
      triageDecidedBy: null,
      triageNote: null,
      eventWebhookPending: true,
    });
  }

  return [...eventAlerts, ...orphanMediaAlerts].sort(
    (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
  );
}

export async function listCameraAlerts(
  prisma: PrismaClient,
  args: {
    limit?: number;
    hours?: number;
    acceptedOnly?: boolean;
    backfillMedia?: boolean;
    triageFilter?: "all" | "pending" | "decided";
  }
): Promise<{
  alerts: CameraAlertItem[];
  configured: boolean;
  diagnostics: CameraAlertsDiagnostics;
}> {
  const hours = args.hours ?? 168;
  const defaultLimit = hours > 48 ? 60 : 40;
  const limit = Math.min(Math.max(args.limit ?? defaultLimit, 1), 100);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const enabledAlarmIds = await getEnabledAlarmIdSet(prisma);

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
      take: Math.min(limit * 2, 120),
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

  const enrichedEvents = allEventRows.map((row) => enrichEventRow(row, enabledAlarmIds));
  const ingestEventsRejected = enrichedEvents.filter((row) => !row.accepted).length;

  if (args.backfillMedia !== false) {
    const maxBackfill = args.triageFilter === "pending" ? PENDING_INBOX_MAX_FETCH : undefined;
    await backfillMissingAutonomiseMedia(prisma, enrichedEvents, maxBackfill);

    const ids = enrichedEvents.map((row) => row.id);
    if (ids.length > 0) {
      const freshRows = await prisma.autonomiseWebhookIngest.findMany({
        where: { id: { in: ids } },
        select: { id: true, mediaUrl: true, driverName: true, vehicleRego: true },
      });
      const freshById = new Map(freshRows.map((row) => [row.id, row]));
      for (const row of enrichedEvents) {
        const fresh = freshById.get(row.id);
        if (!fresh) continue;
        if (fresh.mediaUrl) row.mediaUrl = fresh.mediaUrl;
        if (fresh.driverName) row.driverName = fresh.driverName;
        if (fresh.vehicleRego) row.vehicleRego = fresh.vehicleRego;
      }
    }
  }

  const triageByIngestId = await loadTriageByIngestIds(
    prisma,
    enrichedEvents.map((row) => row.id)
  );

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

  const alerts = buildCameraAlertsFromRows(displayEvents, mediaRows, matchEventKeys, triageByIngestId);
  const mediaWithoutMatchingEvent = alerts.filter((a) => a.eventWebhookPending).length;

  const triageFilter = args.triageFilter ?? "all";
  const triageFiltered =
    triageFilter === "pending"
      ? alerts.filter((a) => a.accepted && a.triageStatus === "pending")
      : triageFilter === "decided"
        ? alerts.filter((a) => a.triageStatus !== "pending")
        : alerts;

  const configured =
    Boolean(getAutonomiseWebhookSecretFromEnv()) || ingestEvents > 0 || ingestMedia > 0;
  const apiConfigured = isAutonomiseApiConfigured();

  const visibleAlerts = args.acceptedOnly
    ? triageFiltered.filter((a) => a.accepted || a.eventWebhookPending)
    : triageFiltered;

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
