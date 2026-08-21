/**
 * Dual-layer fusion inverse: recover the TPMA biological floor from combined % + TSI.
 * Matches frms-engine W_STRAIN = 0.20.
 * R_combined = R_tpma + (100 - R_tpma) * (T/100) * w
 */

export const FRMS_STRAIN_WEIGHT = 0.2;

export function biologicalFloorPct(
  combinedPct: number,
  taskStrainIndex: number | null | undefined
): number {
  const combined = Math.max(0, Math.min(100, combinedPct));
  const t = Math.max(0, Math.min(100, taskStrainIndex ?? 0)) / 100;
  if (t <= 0) return Math.round(combined);
  const denom = 1 - FRMS_STRAIN_WEIGHT * t;
  if (denom < 0.05) return Math.round(combined);
  const raw = (combined - 100 * FRMS_STRAIN_WEIGHT * t) / denom;
  return Math.round(Math.max(0, Math.min(combined, raw)));
}
