/** Ignore retargeted clicks after the hero swaps to a split (same-finger / iOS ghost click). */
export const HERO_CHOOSER_GHOST_MS = 450;

export function isHeroChooserGhostClick(chooserOpenedAtMs: number, nowMs = Date.now()): boolean {
  if (chooserOpenedAtMs <= 0) return false;
  return nowMs - chooserOpenedAtMs < HERO_CHOOSER_GHOST_MS;
}
