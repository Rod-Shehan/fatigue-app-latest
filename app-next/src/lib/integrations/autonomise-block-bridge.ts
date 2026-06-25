/**
 * Autonomise discrete events → 15-min DriverRiskBlock (assurance metrics only).
 * Sheet-duty auto attribution + manual manager backfill. Not tied to Live alert triage.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  CAMERA_RISK_BLOCK_MINUTES,
  CAMERA_RISK_PACKET_VERSION,
  type CameraBlockFeatures,
  type CameraRiskPacketV1,
} from "@/lib/camera-risk-packet";
import {
  AUTONOMISE_BRIDGE_ALARM_IDS,
  autonomiseBlockUploadId,
  isAutonomiseBlockBridgeEnabled,
} from "@/lib/integrations/autonomise-block-bridge-config";
import { extractAutonomiseFields } from "@/lib/integrations/autonomise-payload";
import { resolveDriverFromSheetDuty } from "@/lib/integrations/autonomise-sheet-attribution";
import { alignToBlockStartMs, RISK_BLOCK_MINUTES } from "@/lib/manager-risk-timeline";
import {
  computeFusedRiskPercents,
  enrichDiaryWithSheetAlertness,
} from "@/lib/risk-block-ingest";

export type AutonomiseBridgeAttributionSource = "sheet_duty" | "manual";

export type AutonomiseBridgeResult = {
  bridged: boolean;
  skippedReason?: string;
  driverName?: string;
  blockStartMs?: number;
  livePct?: number;
  created?: boolean;
};

function parseTriggerTimeMs(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const raw = (payload as Record<string, unknown>).triggerTime;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function syntheticFeaturesFromCounts(fatigueCount: number, distractionCount: number): CameraBlockFeatures {
  const drowsinessScore = fatigueCount > 0 ? 1 - Math.exp(-0.7 * fatigueCount) : 0;
  const distractionScore = distractionCount > 0 ? 1 - Math.exp(-0.5 * distractionCount) : 0;
  const eventTotal = fatigueCount + distractionCount;
  const sampleCoveragePct = Math.min(100, 25 * eventTotal);
  return {
    drowsinessScore,
    distractionScore,
    eyesOffRoadSeconds: 0,
    sampleCoveragePct,
    yawnCount: 0,
    headNodCount: fatigueCount,
  };
}

function buildSyntheticPacket(args: {
  blockStartMs: number;
  deviceId: string | null;
  features: CameraBlockFeatures;
  fatigueCount: number;
  distractionCount: number;
  attributionSource: AutonomiseBridgeAttributionSource;
  ingestEventIds: string[];
}): CameraRiskPacketV1 {
  const blockStart = new Date(args.blockStartMs).toISOString();
  return {
    schema_version: CAMERA_RISK_PACKET_VERSION,
    packet_id: `autonomise-${args.blockStartMs}-${args.ingestEventIds.length}`,
    device_id: args.deviceId ?? "autonomise",
    block_start: blockStart,
    block_minutes: CAMERA_RISK_BLOCK_MINUTES,
    metrics: {
      drowsiness_score: args.features.drowsinessScore,
      distraction_score: args.features.distractionScore,
      eyes_off_road_seconds: 0,
      yawn_count: 0,
      head_nod_count: args.features.headNodCount,
      sample_coverage_pct: args.features.sampleCoveragePct,
    },
    vendor: {
      source: "autonomise",
      attribution: args.attributionSource,
      fatigue_event_count: args.fatigueCount,
      distraction_event_count: args.distractionCount,
      ingest_event_ids: args.ingestEventIds,
    },
  };
}

export async function resolveUserIdForDriverName(
  prisma: PrismaClient,
  driverName: string
): Promise<string | null> {
  const trimmed = driverName.trim();
  if (!trimmed) return null;

  const roster = await prisma.driver.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" }, isActive: true },
    select: { email: true },
  });
  if (roster?.email) {
    const user = await prisma.user.findUnique({
      where: { email: roster.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (user) return user.id;
  }

  const byName = await prisma.user.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  return byName?.id ?? null;
}

function isFatigueAlarm(alarmId: string | null | undefined): boolean {
  return alarmId === "VT3600AI_ALARM_DSM_Fatigue";
}

function isDistractionAlarm(alarmId: string | null | undefined): boolean {
  return alarmId === "VT3600AI_ALARM_DSM_Distracted";
}

/** Count bridge-eligible events attributed to a driver in one 15-min block. */
export async function collectAttributedEventsForBlock(
  prisma: PrismaClient,
  args: { driverName: string; blockStartMs: number }
): Promise<
  Array<{
    ingestId: string;
    vendorAlarmId: string | null;
    deviceHardwareId: string | null;
    payload: Prisma.JsonValue;
  }>
> {
  const blockEndMs = args.blockStartMs + RISK_BLOCK_MINUTES * 60 * 1000;
  const attributions = await prisma.autonomiseMetricsAttribution.findMany({
    where: {
      driverName: args.driverName,
      blockStartMs: BigInt(args.blockStartMs),
    },
    select: { ingestEventId: true },
  });
  if (attributions.length === 0) return [];

  const ingestIds = attributions.map((a) => a.ingestEventId);
  const rows = await prisma.autonomiseWebhookIngest.findMany({
    where: {
      id: { in: ingestIds },
      kind: "event",
      accepted: true,
    },
    select: { id: true, vendorAlarmId: true, payload: true },
  });

  return rows
    .filter((row) => {
      if (!AUTONOMISE_BRIDGE_ALARM_IDS.has(row.vendorAlarmId ?? "")) return false;
      const triggerMs = parseTriggerTimeMs(row.payload) ?? null;
      if (triggerMs == null) return true;
      return triggerMs >= args.blockStartMs && triggerMs < blockEndMs;
    })
    .map((row) => ({
      ingestId: row.id,
      vendorAlarmId: row.vendorAlarmId,
      deviceHardwareId: extractAutonomiseFields(row.payload, "event").deviceHardwareId,
      payload: row.payload,
    }));
}

export async function rebuildAutonomiseRiskBlock(
  prisma: PrismaClient,
  args: {
    driverName: string;
    userId: string;
    blockStartMs: number;
    attributionSource: AutonomiseBridgeAttributionSource;
  }
): Promise<AutonomiseBridgeResult> {
  const blockStartMs = alignToBlockStartMs(args.blockStartMs);
  const events = await collectAttributedEventsForBlock(prisma, {
    driverName: args.driverName,
    blockStartMs,
  });

  if (events.length === 0) {
    return { bridged: false, skippedReason: "no_attributed_events" };
  }

  let fatigueCount = 0;
  let distractionCount = 0;
  let deviceId: string | null = null;
  for (const ev of events) {
    if (isFatigueAlarm(ev.vendorAlarmId)) fatigueCount += 1;
    if (isDistractionAlarm(ev.vendorAlarmId)) distractionCount += 1;
    if (!deviceId && ev.deviceHardwareId) deviceId = ev.deviceHardwareId;
  }

  const features = syntheticFeaturesFromCounts(fatigueCount, distractionCount);
  const packet = buildSyntheticPacket({
    blockStartMs,
    deviceId,
    features,
    fatigueCount,
    distractionCount,
    attributionSource: args.attributionSource,
    ingestEventIds: events.map((e) => e.ingestId),
  });

  const diary = await enrichDiaryWithSheetAlertness(prisma, args.driverName, blockStartMs);
  const { baselinePct, livePct, fusionSources } = computeFusedRiskPercents(blockStartMs, features, diary);
  const sources = [...new Set([...fusionSources, "autonomise"])];

  const uploadId = autonomiseBlockUploadId(args.userId, blockStartMs);

  const nativeBlock = await prisma.driverRiskBlock.findFirst({
    where: {
      userId: args.userId,
      blockStartMs: BigInt(blockStartMs),
      NOT: { uploadId: { startsWith: "autonomise-block:" } },
      fusionSources: { has: "camera" },
    },
    select: { id: true },
  });
  if (nativeBlock) {
    return { bridged: false, skippedReason: "circadia_edge_block_present" };
  }

  const existing = await prisma.driverRiskBlock.findUnique({
    where: { userId_uploadId: { userId: args.userId, uploadId } },
    select: { id: true },
  });

  await prisma.driverRiskBlock.upsert({
    where: { userId_uploadId: { userId: args.userId, uploadId } },
    create: {
      userId: args.userId,
      driverName: args.driverName,
      blockStartMs: BigInt(blockStartMs),
      blockMinutes: RISK_BLOCK_MINUTES,
      timezone: "Australia/Perth",
      uploadId,
      deviceId,
      packetVersion: CAMERA_RISK_PACKET_VERSION,
      cameraPayload: packet as object,
      diaryContext: diary ? (diary as object) : undefined,
      baselinePct,
      livePct,
      fusionSources: sources,
    },
    update: {
      driverName: args.driverName,
      deviceId,
      cameraPayload: packet as object,
      diaryContext: diary ? (diary as object) : undefined,
      baselinePct,
      livePct,
      fusionSources: sources,
    },
  });

  return {
    bridged: true,
    driverName: args.driverName,
    blockStartMs,
    livePct,
    created: !existing,
  };
}

export async function recordManualAttribution(
  prisma: PrismaClient,
  args: {
    ingestEventId: string;
    driverName: string;
    blockStartMs: number;
    attributedByUserId: string;
  }
): Promise<void> {
  await prisma.autonomiseMetricsAttribution.upsert({
    where: { ingestEventId: args.ingestEventId },
    create: {
      ingestEventId: args.ingestEventId,
      driverName: args.driverName.trim(),
      source: "manual",
      blockStartMs: BigInt(alignToBlockStartMs(args.blockStartMs)),
      attributedByUserId: args.attributedByUserId,
    },
    update: {
      driverName: args.driverName.trim(),
      source: "manual",
      blockStartMs: BigInt(alignToBlockStartMs(args.blockStartMs)),
      attributedByUserId: args.attributedByUserId,
    },
  });
}

export async function recordSheetDutyAttribution(
  prisma: PrismaClient,
  args: { ingestEventId: string; driverName: string; blockStartMs: number }
): Promise<void> {
  await prisma.autonomiseMetricsAttribution.upsert({
    where: { ingestEventId: args.ingestEventId },
    create: {
      ingestEventId: args.ingestEventId,
      driverName: args.driverName.trim(),
      source: "sheet_duty",
      blockStartMs: BigInt(alignToBlockStartMs(args.blockStartMs)),
    },
    update: {
      driverName: args.driverName.trim(),
      source: "sheet_duty",
      blockStartMs: BigInt(alignToBlockStartMs(args.blockStartMs)),
    },
  });
}

/** After accepted event ingest — sheet-duty only; skips when attribution fails. */
export async function maybeBridgeAutonomiseEventFromIngest(
  prisma: PrismaClient,
  args: {
    ingestId: string;
    vendorAlarmId: string | null;
    vehicleRego: string | null;
    payload: unknown;
  }
): Promise<AutonomiseBridgeResult> {
  if (!isAutonomiseBlockBridgeEnabled()) {
    return { bridged: false, skippedReason: "bridge_disabled" };
  }
  if (!AUTONOMISE_BRIDGE_ALARM_IDS.has(args.vendorAlarmId ?? "")) {
    return { bridged: false, skippedReason: "alarm_not_bridgeable" };
  }

  const triggerMs = parseTriggerTimeMs(args.payload) ?? Date.now();
  const attribution = await resolveDriverFromSheetDuty(prisma, {
    vehicleRego: args.vehicleRego,
    triggerTimeMs: triggerMs,
  });
  if (!attribution.ok) {
    return { bridged: false, skippedReason: attribution.reason };
  }

  const userId = await resolveUserIdForDriverName(prisma, attribution.driverName);
  if (!userId) {
    return { bridged: false, skippedReason: "no_user_for_driver" };
  }

  await recordSheetDutyAttribution(prisma, {
    ingestEventId: args.ingestId,
    driverName: attribution.driverName,
    blockStartMs: attribution.blockStartMs,
  });

  return rebuildAutonomiseRiskBlock(prisma, {
    driverName: attribution.driverName,
    userId,
    blockStartMs: attribution.blockStartMs,
    attributionSource: "sheet_duty",
  });
}

/** Manager manual backfill — explicit driver name, no sheet check. */
export async function manualBridgeAutonomiseEvents(
  prisma: PrismaClient,
  args: {
    ingestIds: string[];
    driverName: string;
    attributedByUserId: string;
  }
): Promise<{
  attributed: number;
  bridged: number;
  results: Array<{ ingestId: string; ok: boolean; reason?: string; livePct?: number }>;
}> {
  if (!isAutonomiseBlockBridgeEnabled()) {
    throw new Error("BRIDGE_DISABLED");
  }

  const driverName = args.driverName.trim();
  const userId = await resolveUserIdForDriverName(prisma, driverName);
  if (!userId) {
    throw new Error("NO_USER_FOR_DRIVER");
  }

  const results: Array<{ ingestId: string; ok: boolean; reason?: string; livePct?: number }> = [];
  const blocksToRebuild = new Set<number>();
  let attributed = 0;

  for (const ingestId of args.ingestIds) {
    const row = await prisma.autonomiseWebhookIngest.findUnique({
      where: { id: ingestId },
      select: { id: true, kind: true, accepted: true, vendorAlarmId: true, payload: true },
    });
    if (!row || row.kind !== "event" || !row.accepted) {
      results.push({ ingestId, ok: false, reason: "not_accepted_event" });
      continue;
    }
    if (!AUTONOMISE_BRIDGE_ALARM_IDS.has(row.vendorAlarmId ?? "")) {
      results.push({ ingestId, ok: false, reason: "alarm_not_bridgeable" });
      continue;
    }

    const triggerMs = parseTriggerTimeMs(row.payload) ?? Date.now();
    const blockStartMs = alignToBlockStartMs(triggerMs);

    await recordManualAttribution(prisma, {
      ingestEventId: ingestId,
      driverName,
      blockStartMs,
      attributedByUserId: args.attributedByUserId,
    });
    attributed += 1;
    blocksToRebuild.add(blockStartMs);
    results.push({ ingestId, ok: true });
  }

  let bridged = 0;
  for (const blockStartMs of blocksToRebuild) {
    const r = await rebuildAutonomiseRiskBlock(prisma, {
      driverName,
      userId,
      blockStartMs,
      attributionSource: "manual",
    });
    if (r.bridged) {
      bridged += 1;
      for (const row of results) {
        if (row.ok && row.livePct === undefined) {
          row.livePct = r.livePct;
        }
      }
    }
  }

  return { attributed, bridged, results };
}
