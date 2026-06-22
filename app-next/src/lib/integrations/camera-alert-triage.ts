import type { PrismaClient } from "@prisma/client";

export type CameraAlertTriageDecision = "authorized" | "dismissed";

export type CameraAlertTriageRecord = {
  ingestEventId: string;
  vendorEventId: string | null;
  decision: CameraAlertTriageDecision;
  note: string | null;
  decidedByUserId: string;
  decidedByEmail: string | null;
  decidedAt: Date;
};

export async function loadTriageByIngestIds(
  prisma: PrismaClient,
  ingestEventIds: string[]
): Promise<Map<string, CameraAlertTriageRecord>> {
  if (ingestEventIds.length === 0) return new Map();

  const rows = await prisma.cameraAlertTriage.findMany({
    where: { ingestEventId: { in: ingestEventIds } },
  });

  const map = new Map<string, CameraAlertTriageRecord>();
  for (const row of rows) {
    if (row.decision !== "authorized" && row.decision !== "dismissed") continue;
    map.set(row.ingestEventId, {
      ingestEventId: row.ingestEventId,
      vendorEventId: row.vendorEventId,
      decision: row.decision,
      note: row.note,
      decidedByUserId: row.decidedByUserId,
      decidedByEmail: row.decidedByEmail,
      decidedAt: row.decidedAt,
    });
  }
  return map;
}

export async function recordCameraAlertTriage(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    vendorEventId: string | null;
    decision: CameraAlertTriageDecision;
    note?: string | null;
    decidedByUserId: string;
    decidedByEmail: string | null;
  }
): Promise<CameraAlertTriageRecord> {
  const existing = await prisma.cameraAlertTriage.findUnique({
    where: { ingestEventId: args.ingestEventId },
  });
  if (existing) {
    throw new Error("ALREADY_DECIDED");
  }

  const eventRow = await prisma.autonomiseWebhookIngest.findFirst({
    where: { id: args.ingestEventId, kind: "event", accepted: true },
    select: { id: true },
  });
  if (!eventRow) {
    throw new Error("EVENT_NOT_FOUND");
  }

  const row = await prisma.cameraAlertTriage.create({
    data: {
      ingestEventId: args.ingestEventId,
      vendorEventId: args.vendorEventId,
      decision: args.decision,
      note: args.note?.trim() || null,
      decidedByUserId: args.decidedByUserId,
      decidedByEmail: args.decidedByEmail,
    },
  });

  return {
    ingestEventId: row.ingestEventId,
    vendorEventId: row.vendorEventId,
    decision: row.decision as CameraAlertTriageDecision,
    note: row.note,
    decidedByUserId: row.decidedByUserId,
    decidedByEmail: row.decidedByEmail,
    decidedAt: row.decidedAt,
  };
}
