import type { AutonomiseWebhookIngest, PrismaClient } from "@prisma/client";
import { getCatalogueEntry } from "@/lib/integrations/fatigue-event-catalogue";

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
>;

export function buildCameraAlertsFromRows(
  events: IngestRow[],
  mediaRows: IngestRow[]
): CameraAlertItem[] {
  const mediaByEventKey = new Map<string, string>();
  for (const row of mediaRows) {
    if (!row.mediaUrl) continue;
    const keys = [row.linkedEventId, row.vendorEventId].filter(Boolean) as string[];
    for (const key of keys) {
      if (!mediaByEventKey.has(key)) mediaByEventKey.set(key, row.mediaUrl);
    }
  }

  return events.map((event) => {
    const entry = event.vendorAlarmId ? getCatalogueEntry(event.vendorAlarmId) : undefined;
    const eventKey = event.vendorEventId;
    const mediaUrl = eventKey ? mediaByEventKey.get(eventKey) ?? null : null;

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
}

export async function listCameraAlerts(
  prisma: PrismaClient,
  args: { limit?: number; hours?: number; acceptedOnly?: boolean }
): Promise<{ alerts: CameraAlertItem[]; configured: boolean }> {
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 100);
  const hours = args.hours ?? 48;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const eventWhere = {
    kind: "event",
    receivedAt: { gte: since },
    ...(args.acceptedOnly ? { accepted: true } : {}),
  };

  const [events, mediaRows] = await Promise.all([
    prisma.autonomiseWebhookIngest.findMany({
      where: eventWhere,
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
      },
    }),
  ]);

  const configured = Boolean(process.env.AUTONOMISE_WEBHOOK_SECRET?.trim());

  return {
    alerts: buildCameraAlertsFromRows(events, mediaRows),
    configured,
  };
}
