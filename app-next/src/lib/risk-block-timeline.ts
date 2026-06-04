/**
 * Build manager risk timeline series from persisted DriverRiskBlock rows.
 */

import type { DriverRiskBlock } from "@prisma/client";
import { extractCameraFeatures, type CameraRiskPacketV1, type RiskBlockDiaryContext } from "@/lib/camera-risk-packet";
import { diaryContextToBlockInput } from "@/lib/risk-block-ingest";
import {
  alignToBlockStartMs,
  blockInputsToRiskPercent,
  findNowBlockStartMs,
  formatBlockLabelPerth,
  RISK_BLOCK_MINUTES,
  type RiskTimelineBlock,
  type RiskTimelineSeries,
} from "@/lib/manager-risk-timeline";

export type StoredRiskBlockRow = Pick<
  DriverRiskBlock,
  | "blockStartMs"
  | "baselinePct"
  | "livePct"
  | "fusionSources"
  | "cameraPayload"
  | "diaryContext"
>;

function blockMs(): number {
  return RISK_BLOCK_MINUTES * 60 * 1000;
}

/** Generate baseline-only slots around stored rows (plan curve without camera). */
export function buildBaselineSlots(
  fromMs: number,
  toMs: number,
  diaryByBlock: Map<number, RiskBlockDiaryContext | undefined>
): RiskTimelineBlock[] {
  const start = alignToBlockStartMs(fromMs);
  const end = alignToBlockStartMs(toMs);
  const nowBlock = findNowBlockStartMs();
  const blocks: RiskTimelineBlock[] = [];

  for (let t = start; t <= end; t += blockMs()) {
    const diary = diaryByBlock.get(t);
    const input = diaryContextToBlockInput(t, diary, undefined);
    input.planDeviationMinutes = 0;
    blocks.push({
      blockStartMs: t,
      label: formatBlockLabelPerth(t),
      baselinePct: blockInputsToRiskPercent(input),
      livePct: undefined,
      isNow: t === nowBlock,
    });
  }
  return blocks;
}

export function mergeStoredBlocksIntoTimeline(
  baselineBlocks: RiskTimelineBlock[],
  stored: StoredRiskBlockRow[]
): RiskTimelineBlock[] {
  const byStart = new Map(baselineBlocks.map((b) => [b.blockStartMs, { ...b }]));

  for (const row of stored) {
    const ms = Number(row.blockStartMs);
    const existing = byStart.get(ms);
    const hasCamera = row.fusionSources.includes("camera");
    if (existing) {
      existing.livePct = row.livePct;
      existing.baselinePct = row.baselinePct;
      existing.hasCamera = hasCamera;
      existing.fusionSources = row.fusionSources;
    } else {
      byStart.set(ms, {
        blockStartMs: ms,
        label: formatBlockLabelPerth(ms),
        baselinePct: row.baselinePct,
        livePct: row.livePct,
        isNow: ms === findNowBlockStartMs(),
        hasCamera,
        fusionSources: row.fusionSources,
      });
    }
  }

  return [...byStart.values()].sort((a, b) => a.blockStartMs - b.blockStartMs);
}

export function buildRiskTimelineFromStoredBlocks(
  driverName: string,
  stored: StoredRiskBlockRow[],
  opts?: { pastBlocks?: number; futureBlocks?: number; nowMs?: number }
): RiskTimelineSeries {
  const nowMs = opts?.nowMs ?? Date.now();
  const nowBlock = findNowBlockStartMs(nowMs);
  const past = opts?.pastBlocks ?? 32;
  const future = opts?.futureBlocks ?? 12;
  const fromMs = nowBlock - past * blockMs();
  const toMs = nowBlock + future * blockMs();

  const diaryByBlock = new Map<number, RiskBlockDiaryContext | undefined>();
  for (const row of stored) {
    const ms = Number(row.blockStartMs);
    diaryByBlock.set(ms, (row.diaryContext as RiskBlockDiaryContext | null) ?? undefined);
  }

  const baseline = buildBaselineSlots(fromMs, toMs, diaryByBlock);
  const blocks = mergeStoredBlocksIntoTimeline(baseline, stored);

  return {
    driverName,
    timezone: "Australia/Perth",
    blocks,
    nowBlockStartMs: nowBlock,
  };
}

export function latestStoredBlockCamera(stored: StoredRiskBlockRow[]): ReturnType<typeof extractCameraFeatures> | undefined {
  if (stored.length === 0) return undefined;
  const sorted = [...stored].sort((a, b) => Number(b.blockStartMs) - Number(a.blockStartMs));
  const latest = sorted.find((r) => r.fusionSources.includes("camera"));
  if (!latest) return undefined;
  try {
    return extractCameraFeatures(latest.cameraPayload as unknown as CameraRiskPacketV1);
  } catch {
    return undefined;
  }
}
