/**
 * Server-side ingest: validate camera packets, fuse with diary context, persist blocks.
 */

import type { PrismaClient } from "@prisma/client";
import type { CameraBlockFeatures, CameraRiskPacketV1, RiskBlockDiaryContext, RiskBlockUploadItem } from "@/lib/camera-risk-packet";
import { extractCameraFeatures, parseCameraRiskPacket } from "@/lib/camera-risk-packet";
import {
  alignToBlockStartMs,
  blockInputsToRiskPercent,
  type RiskTimelineBlockInput,
} from "@/lib/manager-risk-timeline";

export type IngestRiskBlockParams = {
  userId: string;
  driverName: string;
  item: RiskBlockUploadItem;
  timezone?: string;
};

export function diaryContextToBlockInput(
  blockStartMs: number,
  diary: RiskBlockDiaryContext | undefined,
  camera?: CameraBlockFeatures
): RiskTimelineBlockInput {
  const localHour =
    diary?.local_hour ??
    Number(
      new Date(blockStartMs).toLocaleString("en-AU", {
        timeZone: "Australia/Perth",
        hour: "numeric",
        hour12: false,
      })
    ) +
      Number(
        new Date(blockStartMs).toLocaleString("en-AU", {
          timeZone: "Australia/Perth",
          minute: "numeric",
        })
      ) /
        60;

  const workMinutes = Math.min(15, Math.max(0, diary?.work_minutes ?? 0));
  const minutesSinceBreak = Math.max(0, diary?.minutes_since_break ?? 0);
  const recoveryMinutesInBlock =
    workMinutes === 0 && minutesSinceBreak < 20 ? 15 : 0;
  const nonWorkBlock = workMinutes === 0 && minutesSinceBreak < 5;

  return {
    blockStartMs,
    workMinutes,
    minutesSinceBreak,
    rollingWorkHours14d: diary?.rolling_work_hours_14d ?? 120,
    localHour,
    planDeviationMinutes: Math.max(0, diary?.plan_deviation_minutes ?? 0),
    recoveryMinutesInBlock,
    nonWorkBlock,
    camera,
  };
}

export function computeFusedRiskPercents(
  blockStartMs: number,
  camera: CameraBlockFeatures,
  diary?: RiskBlockDiaryContext
): { baselinePct: number; livePct: number; fusionSources: string[] } {
  const alignedMs = alignToBlockStartMs(blockStartMs);
  const liveInput = diaryContextToBlockInput(alignedMs, diary, camera);
  const baselineInput = diaryContextToBlockInput(alignedMs, diary, undefined);
  baselineInput.planDeviationMinutes = 0;

  const fusionSources = ["camera"];
  if (diary) fusionSources.push("diary");

  return {
    baselinePct: blockInputsToRiskPercent(baselineInput),
    livePct: blockInputsToRiskPercent(liveInput),
    fusionSources,
  };
}

export async function ingestDriverRiskBlock(
  prisma: PrismaClient,
  params: IngestRiskBlockParams
): Promise<{ created: boolean; blockStartMs: number; livePct: number }> {
  const parsed = parseCameraRiskPacket(params.item.camera);
  if (!parsed.ok) throw new Error(parsed.error);

  const blockStartMs = alignToBlockStartMs(params.item.block_start_ms);
  const camera = parsed.parsed.features;
  const { baselinePct, livePct, fusionSources } = computeFusedRiskPercents(
    blockStartMs,
    camera,
    params.item.diary
  );

  const timezone = params.timezone ?? "Australia/Perth";
  const cameraPayload = params.item.camera as unknown as CameraRiskPacketV1;

  const existing = await prisma.driverRiskBlock.findUnique({
    where: {
      userId_uploadId: {
        userId: params.userId,
        uploadId: params.item.upload_id,
      },
    },
  });

  if (existing) {
    return { created: false, blockStartMs: Number(existing.blockStartMs), livePct: existing.livePct };
  }

  await prisma.driverRiskBlock.create({
    data: {
      userId: params.userId,
      driverName: params.driverName,
      blockStartMs: BigInt(blockStartMs),
      blockMinutes: 15,
      timezone,
      uploadId: params.item.upload_id,
      deviceId: params.item.camera.device_id,
      packetVersion: params.item.camera.schema_version,
      cameraPayload: cameraPayload as object,
      diaryContext: params.item.diary ? (params.item.diary as object) : undefined,
      baselinePct,
      livePct,
      fusionSources,
    },
  });

  return { created: true, blockStartMs, livePct };
}

export async function ingestDriverRiskBlockBatch(
  prisma: PrismaClient,
  params: {
    userId: string;
    driverName: string;
    items: RiskBlockUploadItem[];
    timezone?: string;
  }
): Promise<{ accepted: number; skipped: number; results: { upload_id: string; created: boolean; live_pct: number }[] }> {
  const results: { upload_id: string; created: boolean; live_pct: number }[] = [];
  let accepted = 0;
  let skipped = 0;

  for (const item of params.items) {
    const r = await ingestDriverRiskBlock(prisma, {
      userId: params.userId,
      driverName: params.driverName,
      item,
      timezone: params.timezone,
    });
    results.push({ upload_id: item.upload_id, created: r.created, live_pct: r.livePct });
    if (r.created) accepted++;
    else skipped++;
  }

  return { accepted, skipped, results };
}
