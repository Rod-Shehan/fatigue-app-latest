/**
 * Signature metadata helpers for checklist Confirm Signature (UTC + AWST + geo).
 */

export const CHECKLIST_AWST_TZ = "Australia/Perth";

export function formatSignedAtUtc(date: Date = new Date()): string {
  return date.toISOString();
}

export function formatSignedAtAwst(date: Date = new Date()): string {
  return date.toLocaleString("en-AU", {
    timeZone: CHECKLIST_AWST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function buildSignatureCapture(opts: {
  pngDataUrl: string;
  now?: Date;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
}): {
  pngDataUrl: string;
  signedAtUtc: string;
  signedAtAwst: string;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
} {
  const now = opts.now ?? new Date();
  return {
    pngDataUrl: opts.pngDataUrl,
    signedAtUtc: formatSignedAtUtc(now),
    signedAtAwst: formatSignedAtAwst(now),
    lat: opts.lat ?? null,
    lng: opts.lng ?? null,
    accuracyM: opts.accuracyM ?? null,
  };
}
