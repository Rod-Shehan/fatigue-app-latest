/**
 * Build RiskBlockDiaryContext for camera risk-block upload (co-uploaded with 15-min packets).
 */

import type { DayData } from "@/lib/api";
import type { RiskBlockDiaryContext } from "@/lib/camera-risk-packet";
import { parseCameraRiskPacket } from "@/lib/camera-risk-packet";
import { findAlertnessLevelForSheetDay } from "@/lib/alertness-for-block";
import { getCameraRiskQueue } from "@/lib/camera-risk-queue";
import { alignToBlockStartMs } from "@/lib/manager-risk-timeline";

export type SheetDiaryContext = {
  weekStarting: string;
  days: DayData[];
};

let activeSheetDiaryContext: SheetDiaryContext | null = null;

/** Keep current sheet in memory for camera BT ingest (alertness + diary fusion). */
export function setActiveSheetDiaryContext(ctx: SheetDiaryContext | null): void {
  activeSheetDiaryContext = ctx;
}

export function getActiveSheetDiaryContext(): SheetDiaryContext | null {
  return activeSheetDiaryContext;
}

export function buildRiskBlockDiaryContext(
  blockStartMs: number,
  sheet: SheetDiaryContext,
  extras?: Omit<RiskBlockDiaryContext, "alertness_level">
): RiskBlockDiaryContext {
  const alertness_level = findAlertnessLevelForSheetDay(sheet.weekStarting, sheet.days, blockStartMs);
  return {
    ...extras,
    ...(alertness_level ? { alertness_level } : {}),
  };
}

/**
 * Enqueue a camera packet with sheet-derived diary (including alertness from day card).
 * Call from Web Bluetooth bridge when hardware is connected.
 */
export function enqueueCameraPacketWithSheetDiary(
  raw: unknown,
  sheet: SheetDiaryContext,
  extras?: Omit<RiskBlockDiaryContext, "alertness_level">
): ReturnType<ReturnType<typeof getCameraRiskQueue>["onPacket"]> {
  const parsed = parseCameraRiskPacket(raw);
  if (!parsed.ok) return null;
  const blockStartMs = alignToBlockStartMs(parsed.parsed.blockStartMs);
  const diary = buildRiskBlockDiaryContext(blockStartMs, sheet, extras);
  return getCameraRiskQueue().onPacket(raw, diary);
}

/** Prefer active sheet context; falls back to camera-only queue when sheet not loaded. */
export function enqueueCameraPacketWithActiveSheet(
  raw: unknown,
  extras?: Omit<RiskBlockDiaryContext, "alertness_level">
): ReturnType<ReturnType<typeof getCameraRiskQueue>["onPacket"]> {
  if (!activeSheetDiaryContext) {
    return getCameraRiskQueue().onPacket(raw);
  }
  return enqueueCameraPacketWithSheetDiary(raw, activeSheetDiaryContext, extras);
}
