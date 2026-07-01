/**
 * Normalised verified-distraction trigger reasons — keep in sync with app-next.
 */

export const VERIFIED_DISTRACTION_REASONS = [
  {
    id: "mobile_phone_use",
    label: "Mobile phone use",
    exportHeader: "mobile phone use",
  },
  {
    id: "eating",
    label: "Eating",
    exportHeader: "eating",
  },
  {
    id: "paperwork",
    label: "Paperwork",
    exportHeader: "paperwork",
  },
] as const;

export type VerifiedDistractionReasonId = (typeof VERIFIED_DISTRACTION_REASONS)[number]["id"];

export const VERIFIED_DISTRACTION_ACTION_TYPE = "verified_distraction" as const;

const REASON_ID_SET = new Set<string>(VERIFIED_DISTRACTION_REASONS.map((r) => r.id));

export function isVerifiedDistractionReasonId(value: string): value is VerifiedDistractionReasonId {
  return REASON_ID_SET.has(value);
}

export function normalizeVerifiedDistractionReasons(raw: unknown): VerifiedDistractionReasonId[] {
  if (!Array.isArray(raw)) return [];
  const out: VerifiedDistractionReasonId[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!isVerifiedDistractionReasonId(id)) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function verifiedDistractionReasonLabels(ids: readonly VerifiedDistractionReasonId[]): string[] {
  const labels: string[] = [];
  for (const id of ids) {
    const label = VERIFIED_DISTRACTION_REASONS.find((r) => r.id === id)?.label;
    if (label) labels.push(label);
  }
  return labels;
}

export function formatVerifiedDistractionReasonsForNote(
  reasons: readonly VerifiedDistractionReasonId[],
  freeNote?: string | null
): string {
  const labels = verifiedDistractionReasonLabels(reasons);
  const parts: string[] = ["Verified distraction"];
  if (labels.length > 0) {
    parts.push(`Trigger: ${labels.join(", ")}`);
  }
  const trimmed = freeNote?.trim();
  if (trimmed) parts.push(trimmed);
  return parts.join(" — ");
}

export function requireVerifiedDistractionReasons(raw: unknown): VerifiedDistractionReasonId[] {
  const reasons = normalizeVerifiedDistractionReasons(raw);
  if (reasons.length === 0) {
    throw new Error("VERIFIED_DISTRACTION_REASONS_REQUIRED");
  }
  return reasons;
}

export function cameraAlertEventKindFromMetric(fatigueMetricType: string): "fatigue" | "distraction" | "unknown" {
  const metric = fatigueMetricType.trim().toUpperCase();
  if (metric === "DISTRACTION") return "distraction";
  if (metric === "FATIGUE") return "fatigue";
  return "unknown";
}
