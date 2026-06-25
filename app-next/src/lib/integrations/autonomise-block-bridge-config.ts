/**
 * Autonomise → DriverRiskBlock bridge (pilot).
 * Gated by env — disable to stop new writes; purge removes attributed blocks only.
 */

export function isAutonomiseBlockBridgeEnabled(): boolean {
  const raw = process.env.AUTONOMISE_BLOCK_BRIDGE_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Manager purge of autonomise-sourced risk blocks + manual attribution rows. */
export function isAutonomiseBlockBridgePurgeEnabled(): boolean {
  const raw = process.env.AUTONOMISE_BLOCK_BRIDGE_ALLOW_PURGE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Vendor alarms that may contribute to 15-min assurance blocks (fatigue + distraction only). */
export const AUTONOMISE_BRIDGE_ALARM_IDS = new Set([
  "VT3600AI_ALARM_DSM_Fatigue",
  "VT3600AI_ALARM_DSM_Distracted",
]);

export const AUTONOMISE_BLOCK_UPLOAD_ID_PREFIX = "autonomise-block:";

export function autonomiseBlockUploadId(userId: string, blockStartMs: number): string {
  return `${AUTONOMISE_BLOCK_UPLOAD_ID_PREFIX}${userId}:${blockStartMs}`;
}
