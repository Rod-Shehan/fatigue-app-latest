import type { Prisma, PrismaClient } from "@prisma/client";
import { getCatalogueEntry } from "@/lib/integrations/fatigue-event-catalogue";
import {
  FALSE_POSITIVE_REASONS,
  normalizeFalsePositiveReasons,
  type FalsePositiveReasonId,
} from "@/lib/integrations/false-positive-reasons";

function triggerAtFromPayload(payload: Prisma.JsonValue | undefined): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = (payload as Record<string, unknown>).triggerTime;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export type FalsePositiveExportRow = {
  ingestEventId: string;
  vendorEventId: string | null;
  alertType: string | null;
  vehicleRego: string | null;
  driverName: string | null;
  detectedAt: string | null;
  receivedAt: string;
  decidedAt: string;
  decidedBy: string | null;
  note: string | null;
  reasons: FalsePositiveReasonId[];
};

const BASE_HEADERS = [
  "ingest_event_id",
  "vendor_event_id",
  "alert_type",
  "vehicle_rego",
  "driver_name",
  "detected_at",
  "received_at",
  "decided_at",
  "decided_by",
  "note",
] as const;

export const FALSE_POSITIVE_EXPORT_HEADERS = [
  ...BASE_HEADERS,
  ...FALSE_POSITIVE_REASONS.map((r) => r.exportHeader),
] as const;

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function yn(selected: readonly FalsePositiveReasonId[], id: FalsePositiveReasonId): string {
  return selected.includes(id) ? "Y" : "N";
}

export function falsePositiveExportRowToCells(row: FalsePositiveExportRow): string[] {
  return [
    row.ingestEventId,
    row.vendorEventId ?? "",
    row.alertType ?? "",
    row.vehicleRego ?? "",
    row.driverName ?? "",
    row.detectedAt ?? "",
    row.receivedAt,
    row.decidedAt,
    row.decidedBy ?? "",
    row.note ?? "",
    ...FALSE_POSITIVE_REASONS.map((reason) => yn(row.reasons, reason.id)),
  ];
}

export function buildFalsePositiveExportCsv(rows: FalsePositiveExportRow[]): string {
  const lines = [
    [...FALSE_POSITIVE_EXPORT_HEADERS].map(csvEscape).join(","),
    ...rows.map((row) => falsePositiveExportRowToCells(row).map(csvEscape).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function listFalsePositiveExportRows(
  prisma: PrismaClient,
  args: { since: Date; limit?: number }
): Promise<FalsePositiveExportRow[]> {
  const limit = Math.min(Math.max(args.limit ?? 5000, 1), 10000);

  const triageRows = await prisma.cameraAlertTriage.findMany({
    where: {
      decision: "dismissed",
      decidedAt: { gte: args.since },
    },
    orderBy: { decidedAt: "desc" },
    take: limit,
    select: {
      ingestEventId: true,
      vendorEventId: true,
      note: true,
      falsePositiveReasons: true,
      decidedByEmail: true,
      decidedAt: true,
    },
  });

  if (triageRows.length === 0) return [];

  const ingestIds = triageRows.map((row) => row.ingestEventId);
  const ingestRows = await prisma.autonomiseWebhookIngest.findMany({
    where: { id: { in: ingestIds }, kind: "event" },
    select: {
      id: true,
      vendorAlarmId: true,
      vendorEventId: true,
      vehicleRego: true,
      driverName: true,
      receivedAt: true,
      payload: true,
    },
  });
  const ingestById = new Map(ingestRows.map((row) => [row.id, row]));

  return triageRows.map((triage) => {
    const ingest = ingestById.get(triage.ingestEventId);
    const entry = ingest?.vendorAlarmId ? getCatalogueEntry(ingest.vendorAlarmId) : undefined;
    const detectedAt = ingest ? triggerAtFromPayload(ingest.payload) : null;
    return {
      ingestEventId: triage.ingestEventId,
      vendorEventId: triage.vendorEventId ?? ingest?.vendorEventId ?? null,
      alertType: entry?.displayName ?? ingest?.vendorAlarmId ?? null,
      vehicleRego: ingest?.vehicleRego ?? null,
      driverName: ingest?.driverName ?? null,
      detectedAt,
      receivedAt: ingest?.receivedAt.toISOString() ?? triage.decidedAt.toISOString(),
      decidedAt: triage.decidedAt.toISOString(),
      decidedBy: triage.decidedByEmail,
      note: triage.note,
      reasons: normalizeFalsePositiveReasons(triage.falsePositiveReasons),
    };
  });
}
