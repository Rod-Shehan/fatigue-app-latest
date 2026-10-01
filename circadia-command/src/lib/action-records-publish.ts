/**
 * Publish Command action records — actioned incidents in a rolling window.
 */

import { Prisma } from "@prisma/client";
import { resolveReviewMediaUrl } from "@/lib/autonomise-media-extract";
import { DRIVER_NAMED_ACTION, resolveDriverNamesByEventId } from "@/lib/event-driver-name";
import { hydratePendingEdgeMediaFromIngest } from "@/lib/hydrate-edge-media";
import type { TxClient } from "@/lib/privileged-db";
import { TRIAGE_SHIFT_TIMEZONE } from "@/lib/triage-shift";
import { resolutionActionLabel } from "@/lib/triage-resolution";
import { canAttemptVideoPlayback } from "@/lib/video-clip";
import { buildStoredZip } from "@/lib/zip-store";

export const ACTION_RECORD_WINDOWS = ["24h", "week", "month"] as const;
export type ActionRecordWindow = (typeof ACTION_RECORD_WINDOWS)[number];

export const ACTION_RECORD_PACKS = ["video", "list"] as const;
export type ActionRecordPack = (typeof ACTION_RECORD_PACKS)[number];

export const ACTION_RECORD_NAV_LABEL = "Records";
export const ACTION_RECORD_PAGE_TITLE = "Action records";

export const ACTION_RECORD_WINDOW_LABELS: Record<ActionRecordWindow, string> = {
  "24h": "Last 24 hours",
  week: "Last week",
  month: "Last month",
};

export const ACTION_RECORD_PACK_LABELS: Record<ActionRecordPack, string> = {
  video: "Video and event metadata",
  list: "Event list with metadata and action taken",
};

export const ACTION_RECORD_WINDOW_HOURS: Record<ActionRecordWindow, number> = {
  "24h": 24,
  week: 168,
  month: 720,
};

export const ACTION_RECORD_MAX_ROWS = 500;

const ACTIONED_STATUSES = [
  "VERIFIED_FALSE_POSITIVE",
  "VERIFIED_TRUE_FATIGUE",
  "CLOSED",
] as const;

export type ActionRecordRow = {
  lifecycleId: string;
  eventId: string;
  eventAtIso: string;
  eventAtLabel: string;
  actionedAtIso: string;
  actionedAtLabel: string;
  driverName: string;
  vehicleRego: string;
  eventType: string;
  confidence: string;
  speedKmh: string;
  outcome: string;
  actionTaken: string;
  notes: string;
  actor: string;
  videoUrl: string | null;
};

export type ActionRecordPreview = {
  window: ActionRecordWindow;
  windowLabel: string;
  sinceIso: string;
  generatedAtIso: string;
  count: number;
  truncated: boolean;
  records: ActionRecordRow[];
};

type LifecycleQueryRow = {
  lifecycle_id: string;
  event_id: string;
  event_status: string;
  operator_notes: string | null;
  detected_at: Date;
  triaged_at: Date | null;
  closed_at: Date | null;
  operator_id: string | null;
  driver_id_uuid: string;
  vehicle_registration: string;
  fatigue_metric_type: string;
  confidence_score: string | null;
  video_snippet_url: string;
  source_ingest_id: string | null;
  hardware_timestamp: Date;
  speed_kmh: string | null;
  operator_name: string | null;
};

type ActionLogRow = {
  lifecycleId: string | null;
  actionType: string;
  resolutionNotes: string | null;
  actorLabel: string | null;
  createdAt: Date;
};

type IngestRow = {
  id: string;
  driverName: string | null;
  vehicleRego: string | null;
  vendorAlarmId: string | null;
  mediaUrl: string | null;
  payload: unknown;
};

export function parseActionRecordWindow(raw: string | null | undefined): ActionRecordWindow {
  if (raw === "24h" || raw === "week" || raw === "month") return raw;
  throw new Error("Choose last 24 hours, last week, or last month.");
}

export function parseActionRecordPack(raw: string | null | undefined): ActionRecordPack {
  if (raw === "list" || raw === "video") return raw;
  throw new Error("Choose video and event metadata, or a list of events.");
}

export function actionRecordSince(window: ActionRecordWindow, now = new Date()): Date {
  return new Date(now.getTime() - ACTION_RECORD_WINDOW_HOURS[window] * 60 * 60 * 1000);
}

export function formatPerthPublishDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString("en-AU", {
    timeZone: TRIAGE_SHIFT_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function outcomeLabel(status: string, actionType: string | null): string {
  if (status === "VERIFIED_FALSE_POSITIVE") return "False positive";
  if (actionType === "verified_distraction") return "Verified distraction";
  if (status === "VERIFIED_TRUE_FATIGUE") return "Verified fatigue";
  if (status === "CLOSED") return "Closed";
  return status.replace(/_/g, " ");
}

export function actionTakenLabel(status: string, actionType: string | null): string {
  if (actionType) return resolutionActionLabel(actionType);
  if (status === "VERIFIED_FALSE_POSITIVE") return "Dismissed as false positive";
  if (status === "VERIFIED_TRUE_FATIGUE") return "Verified fatigue";
  if (status === "CLOSED") return "Closed";
  return status.replace(/_/g, " ");
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export const ACTION_RECORD_CSV_HEADERS = [
  "Event time (Perth)",
  "Actioned at (Perth)",
  "Driver",
  "Vehicle",
  "Event type",
  "Confidence",
  "Speed (km/h)",
  "Outcome",
  "Action taken",
  "Notes",
  "Actor",
  "Event ID",
  "Video URL",
] as const;

export function actionRecordToCsvCells(row: ActionRecordRow): string[] {
  return [
    row.eventAtLabel,
    row.actionedAtLabel,
    row.driverName,
    row.vehicleRego,
    row.eventType,
    row.confidence,
    row.speedKmh,
    row.outcome,
    row.actionTaken,
    row.notes,
    row.actor,
    row.eventId,
    row.videoUrl ?? "",
  ];
}

export function buildActionRecordsCsv(rows: ActionRecordRow[]): string {
  const lines = [
    [...ACTION_RECORD_CSV_HEADERS].map(csvEscape).join(","),
    ...rows.map((row) => actionRecordToCsvCells(row).map(csvEscape).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function publishFilenameDate(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: TRIAGE_SHIFT_TIMEZONE });
}

export function actionRecordsDownloadName(
  pack: ActionRecordPack,
  window: ActionRecordWindow,
  now = new Date()
): string {
  const ext = pack === "video" ? "zip" : "csv";
  return `circadia-command-action-records-${pack}-${window}-${publishFilenameDate(now)}.${ext}`;
}

export function buildActionRecordsHtml(
  preview: ActionRecordPreview,
  generatedAt = new Date()
): string {
  const articles = preview.records
    .map((row) => {
      const fields: Array<[string, string]> = [
        ["Event time", row.eventAtLabel],
        ["Actioned at", row.actionedAtLabel],
        ["Driver", row.driverName || "—"],
        ["Vehicle", row.vehicleRego || "—"],
        ["Event type", row.eventType || "—"],
        ["Confidence", row.confidence || "—"],
        ["Speed", row.speedKmh ? `${row.speedKmh} km/h` : "—"],
        ["Outcome", row.outcome],
        ["Action taken", row.actionTaken],
        ["Notes", row.notes || "—"],
        ["Actor", row.actor || "—"],
        ["Event ID", row.eventId],
      ];
      const dl = fields
        .map(
          ([label, value]) =>
            `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`
        )
        .join("");
      let media = `<p class="no-video">No video available.</p>`;
      if (row.videoUrl && canAttemptVideoPlayback(row.videoUrl)) {
        media = `<video controls preload="metadata" src="${escapeHtml(row.videoUrl)}"></video>`;
      } else if (row.videoUrl) {
        media = `<p><a href="${escapeHtml(row.videoUrl)}">Open media</a></p>`;
      }
      return `<article><h2>${escapeHtml(row.driverName || "Event")} · ${escapeHtml(row.outcome)}</h2><dl>${dl}</dl>${media}</article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<title>Circadia Command action records — ${escapeHtml(preview.windowLabel)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 24px; color: #0f172a; background: #f8fafc; }
  h1 { font-size: 1.4rem; margin: 0 0 0.35rem; }
  .meta { color: #475569; margin-bottom: 1.5rem; }
  article { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
  h2 { font-size: 1.05rem; margin: 0 0 12px; }
  dl { display: grid; grid-template-columns: 10rem 1fr; gap: 4px 12px; margin: 0; }
  dt { color: #64748b; }
  dd { margin: 0; }
  video { width: 100%; max-width: 720px; margin-top: 12px; background: #0f172a; }
  .no-video { color: #64748b; margin: 12px 0 0; }
</style>
</head>
<body>
<h1>Circadia Command action records</h1>
<p class="meta">${escapeHtml(preview.windowLabel)} · ${preview.count} event${preview.count === 1 ? "" : "s"} · Published ${escapeHtml(formatPerthPublishDateTime(generatedAt))} Perth${preview.truncated ? " · First 500 shown" : ""}</p>
${articles || "<p>No actioned events in this window.</p>"}
</body>
</html>
`;
}

export function buildActionRecordsVideoZip(
  preview: ActionRecordPreview,
  now = new Date()
): Uint8Array {
  const encoder = new TextEncoder();
  return buildStoredZip(
    [
      { name: "index.html", data: encoder.encode(buildActionRecordsHtml(preview, now)) },
      { name: "events.csv", data: encoder.encode(buildActionRecordsCsv(preview.records)) },
      {
        name: "events.json",
        data: encoder.encode(
          JSON.stringify(
            {
              window: preview.window,
              windowLabel: preview.windowLabel,
              since: preview.sinceIso,
              generatedAt: preview.generatedAtIso,
              count: preview.count,
              truncated: preview.truncated,
              records: preview.records,
            },
            null,
            2
          )
        ),
      },
    ],
    now
  );
}

function latestActionByLifecycle(logs: ActionLogRow[]): Map<string, ActionLogRow> {
  const latest = new Map<string, ActionLogRow>();
  for (const log of logs) {
    if (!log.lifecycleId || latest.has(log.lifecycleId)) continue;
    if (log.actionType === DRIVER_NAMED_ACTION) continue;
    latest.set(log.lifecycleId, log);
  }
  return latest;
}

async function lookupIngest(
  tx: TxClient,
  ingestIds: string[]
): Promise<Map<string, IngestRow>> {
  const map = new Map<string, IngestRow>();
  if (ingestIds.length === 0) return map;
  const rows = await tx.$queryRaw<IngestRow[]>`
    SELECT id, "driverName", "vehicleRego", "vendorAlarmId", "mediaUrl", payload
    FROM "AutonomiseWebhookIngest"
    WHERE id IN (${Prisma.join(ingestIds)})
  `;
  for (const row of rows) map.set(row.id, row);
  return map;
}

export async function fetchActionRecords(
  tx: TxClient,
  window: ActionRecordWindow,
  now = new Date()
): Promise<ActionRecordPreview> {
  const since = actionRecordSince(window, now);
  const rows = await tx.$queryRaw<LifecycleQueryRow[]>`
    SELECT
      l.lifecycle_id::text AS lifecycle_id,
      l.event_id::text AS event_id,
      l.event_status,
      l.operator_notes,
      l.detected_at,
      l.triaged_at,
      l.closed_at,
      l.operator_id::text AS operator_id,
      l.driver_id_uuid::text AS driver_id_uuid,
      e.vehicle_registration,
      e.fatigue_metric_type,
      e.confidence_score::text AS confidence_score,
      e.video_snippet_url,
      e.source_ingest_id,
      e.hardware_timestamp,
      e.speed_kmh::text AS speed_kmh,
      o.full_name AS operator_name
    FROM fatigue_incident_lifecycle l
    JOIN edge_fatigue_events e ON e.event_id = l.event_id
    LEFT JOIN command_operators o ON o.operator_id = l.operator_id
    WHERE l.event_status IN (${Prisma.join([...ACTIONED_STATUSES])})
      AND (
        l.closed_at >= ${since}
        OR l.triaged_at >= ${since}
        OR EXISTS (
          SELECT 1 FROM "IncidentActionLog" a
          WHERE a."lifecycleId" = l.lifecycle_id
            AND a."createdAt" >= ${since}
        )
      )
    ORDER BY COALESCE(l.closed_at, l.triaged_at, l.detected_at) DESC
    LIMIT ${ACTION_RECORD_MAX_ROWS + 1}
  `;

  const truncated = rows.length > ACTION_RECORD_MAX_ROWS;
  const page = rows.slice(0, ACTION_RECORD_MAX_ROWS);
  const lifecycleIds = page.map((row) => row.lifecycle_id);
  const eventIds = page.map((row) => row.event_id);
  const ingestIds = [
    ...new Set(page.map((row) => row.source_ingest_id).filter((id): id is string => Boolean(id))),
  ];

  const hydrated = await hydratePendingEdgeMediaFromIngest(tx, eventIds);
  const [actions, driverNames, ingest] = await Promise.all([
    lifecycleIds.length === 0
      ? Promise.resolve([] as ActionLogRow[])
      : tx.incidentActionLog.findMany({
          where: { lifecycleId: { in: lifecycleIds } },
          orderBy: { createdAt: "desc" },
          select: {
            lifecycleId: true,
            actionType: true,
            resolutionNotes: true,
            actorLabel: true,
            createdAt: true,
          },
        }),
    resolveDriverNamesByEventId(
      tx,
      page.map((row) => ({
        eventId: row.event_id,
        lifecycleId: row.lifecycle_id,
        driverIdUuid: row.driver_id_uuid,
        sourceIngestId: row.source_ingest_id,
      }))
    ),
    lookupIngest(tx, ingestIds),
  ]);

  const latestActions = latestActionByLifecycle(actions);
  const records: ActionRecordRow[] = [];

  for (const row of page) {
    const latest = latestActions.get(row.lifecycle_id) ?? null;
    const actionedAt = latest?.createdAt ?? row.closed_at ?? row.triaged_at ?? row.detected_at;
    if (actionedAt.getTime() < since.getTime()) continue;

    const ingestRow = row.source_ingest_id ? ingest.get(row.source_ingest_id) : undefined;
    const storedVideo = hydrated.get(row.event_id) ?? row.video_snippet_url;
    const videoUrl =
      resolveReviewMediaUrl(ingestRow?.payload, ingestRow?.vendorAlarmId, ingestRow?.mediaUrl ?? storedVideo) ??
      (canAttemptVideoPlayback(storedVideo) ? storedVideo : null);

    const notes = [latest?.resolutionNotes?.trim(), row.operator_notes?.trim()]
      .filter((part): part is string => Boolean(part))
      .join(" | ");

    records.push({
      lifecycleId: row.lifecycle_id,
      eventId: row.event_id,
      eventAtIso: row.hardware_timestamp.toISOString(),
      eventAtLabel: formatPerthPublishDateTime(row.hardware_timestamp),
      actionedAtIso: actionedAt.toISOString(),
      actionedAtLabel: formatPerthPublishDateTime(actionedAt),
      driverName: driverNames.get(row.event_id) ?? "",
      vehicleRego:
        ingestRow?.vehicleRego?.trim() || row.vehicle_registration?.trim() || "",
      eventType: row.fatigue_metric_type,
      confidence: row.confidence_score ?? "",
      speedKmh: row.speed_kmh ?? "",
      outcome: outcomeLabel(row.event_status, latest?.actionType ?? null),
      actionTaken: actionTakenLabel(row.event_status, latest?.actionType ?? null),
      notes,
      actor: latest?.actorLabel?.trim() || row.operator_name?.trim() || "",
      videoUrl,
    });
  }

  records.sort((a, b) => new Date(b.actionedAtIso).getTime() - new Date(a.actionedAtIso).getTime());

  return {
    window,
    windowLabel: ACTION_RECORD_WINDOW_LABELS[window],
    sinceIso: since.toISOString(),
    generatedAtIso: now.toISOString(),
    count: records.length,
    truncated,
    records,
  };
}
