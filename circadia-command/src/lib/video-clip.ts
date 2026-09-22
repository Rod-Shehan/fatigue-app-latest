/** True when Command can play a review clip (not empty, not a pending Autonomise placeholder). */
export function hasViewableVideoClip(url: string | null | undefined): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;
  if (trimmed.startsWith("pending://")) return false;
  return true;
}
