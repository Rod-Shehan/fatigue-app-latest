/**
 * Driver display name for Command events — ingest first, then payload / roster / operator add.
 */

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { extractDriverFromJson } from "@/lib/autonomise-media-extract";
import { CommandApiError } from "@/lib/errors";
import type { TxClient } from "@/lib/privileged-db";

export const DRIVER_NAMED_ACTION = "driver_named";

export type EventDriverLookup = {
  eventId: string;
  lifecycleId: string;
  driverIdUuid: string;
  sourceIngestId: string | null;
};

export function firstNonEmptyName(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function pickResolvedDriverName(sources: {
  ingestName?: string | null;
  payloadName?: string | null;
  attributionName?: string | null;
  identityName?: string | null;
  namedAction?: string | null;
}): string | null {
  return firstNonEmptyName(
    sources.ingestName,
    sources.payloadName,
    sources.attributionName,
    sources.identityName,
    sources.namedAction
  );
}

export function normalizeDriverName(raw: string | null | undefined): string {
  return raw?.trim().replace(/\s+/g, " ") ?? "";
}

type IngestNameRow = {
  id: string;
  driverName: string | null;
  payload: unknown;
};

type AttributionRow = { ingestEventId: string; driverName: string };
type IdentityRow = { driver_id_uuid: string; name: string | null };
type NamedActionRow = { lifecycleId: string | null; resolutionNotes: string | null };

export async function resolveDriverNamesByEventId(
  tx: TxClient,
  rows: EventDriverLookup[]
): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  if (rows.length === 0) return names;

  const ingestIds = [...new Set(rows.map((row) => row.sourceIngestId).filter((id): id is string => Boolean(id)))];
  const driverIds = [...new Set(rows.map((row) => row.driverIdUuid))];
  const lifecycleIds = [...new Set(rows.map((row) => row.lifecycleId))];

  const [ingestRows, attributionRows, identityRows, namedActions] = await Promise.all([
    ingestIds.length === 0
      ? Promise.resolve([] as IngestNameRow[])
      : tx.$queryRaw<IngestNameRow[]>`
          SELECT id, "driverName", payload
          FROM "AutonomiseWebhookIngest"
          WHERE id IN (${Prisma.join(ingestIds)})
        `,
    ingestIds.length === 0
      ? Promise.resolve([] as AttributionRow[])
      : tx.$queryRaw<AttributionRow[]>`
          SELECT "ingestEventId", "driverName"
          FROM "AutonomiseMetricsAttribution"
          WHERE "ingestEventId" IN (${Prisma.join(ingestIds)})
        `,
    driverIds.length === 0
      ? Promise.resolve([] as IdentityRow[])
      : tx.$queryRaw<IdentityRow[]>`
          SELECT m.driver_id_uuid::text AS driver_id_uuid, u.name
          FROM identity_uuid_map m
          JOIN "User" u ON u.id = m.driver_cuid
          WHERE m.driver_id_uuid::text IN (${Prisma.join(driverIds)})
        `,
    lifecycleIds.length === 0
      ? Promise.resolve([] as NamedActionRow[])
      : tx.incidentActionLog.findMany({
          where: { lifecycleId: { in: lifecycleIds }, actionType: DRIVER_NAMED_ACTION },
          orderBy: { createdAt: "desc" },
          select: { lifecycleId: true, resolutionNotes: true },
        }),
  ]);

  const ingestById = new Map(ingestRows.map((row) => [row.id, row]));
  const attributionByIngest = new Map(
    attributionRows.map((row) => [row.ingestEventId, row.driverName])
  );
  const identityByUuid = new Map(
    identityRows.map((row) => [row.driver_id_uuid, row.name?.trim() || null])
  );
  const namedByLifecycle = new Map<string, string>();
  for (const row of namedActions) {
    if (!row.lifecycleId || namedByLifecycle.has(row.lifecycleId)) continue;
    const name = row.resolutionNotes?.trim();
    if (name) namedByLifecycle.set(row.lifecycleId, name);
  }

  for (const row of rows) {
    const ingest = row.sourceIngestId ? ingestById.get(row.sourceIngestId) : undefined;
    names.set(
      row.eventId,
      pickResolvedDriverName({
        ingestName: ingest?.driverName,
        payloadName: extractDriverFromJson(ingest?.payload).driverName,
        attributionName: row.sourceIngestId ? attributionByIngest.get(row.sourceIngestId) : null,
        identityName: identityByUuid.get(row.driverIdUuid),
        namedAction: namedByLifecycle.get(row.lifecycleId),
      })
    );
  }
  return names;
}

export async function listFleetDriverNames(tx: TxClient): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT name FROM (
      SELECT name FROM "Driver" WHERE "isActive" = true
      UNION
      SELECT name FROM "User"
      WHERE name IS NOT NULL
        AND "disabledAt" IS NULL
        AND (role IS NULL OR role = 'driver')
    ) d
    WHERE trim(name) <> ''
    ORDER BY name
  `;
  return rows.map((row) => row.name.trim()).filter(Boolean);
}

export async function setIncidentDriverName(
  tx: TxClient,
  args: {
    lifecycleId: string;
    driverName: string;
    operatorId: string;
    operatorName: string;
  }
): Promise<string> {
  const driverName = normalizeDriverName(args.driverName);
  if (!driverName) {
    throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Enter a driver name.", 400);
  }
  if (driverName.length > 80) {
    throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Driver name is too long.", 400);
  }

  const row = await tx.fatigueIncidentLifecycle.findUnique({
    where: { lifecycleId: args.lifecycleId },
    include: { event: true },
  });
  if (!row) {
    throw new CommandApiError("ERR_NOT_FOUND", "Incident not found.", 404);
  }

  const ingestId = row.event.sourceIngestId;
  if (ingestId) {
    await tx.$executeRaw`
      UPDATE "AutonomiseWebhookIngest"
      SET "driverName" = ${driverName}
      WHERE id = ${ingestId}
        AND ("driverName" IS NULL OR trim("driverName") = '')
    `;
  }

  await tx.incidentActionLog.create({
    data: {
      id: randomUUID(),
      lifecycleId: args.lifecycleId,
      ingestEventId: ingestId,
      actionType: DRIVER_NAMED_ACTION,
      resolutionNotes: driverName,
      actorType: "command_operator",
      actorId: args.operatorId,
      actorLabel: args.operatorName,
    },
  });

  return driverName;
}
