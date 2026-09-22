import { looksLikeVideoUrl } from "@/lib/autonomise-media-extract";

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i;

export function looksLikeImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url.trim());
}

function httpVideoCandidate(url: string | null | undefined): string | null {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.startsWith("pending://")) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (looksLikeImageUrl(trimmed)) return null;
  return trimmed;
}

/** Try the HTML video element — signed Autonomise URLs may still play without a .mp4 suffix. */
export function canAttemptVideoPlayback(url: string | null | undefined): boolean {
  return httpVideoCandidate(url) != null;
}

/**
 * Lock bulk-remove only when the stored URL looks like a real clip.
 * Snapshots, pending placeholders, and non-http values are not a video file to view.
 */
export function hasViewableVideoClip(url: string | null | undefined): boolean {
  const candidate = httpVideoCandidate(url);
  if (!candidate) return false;
  return looksLikeVideoUrl(candidate);
}
