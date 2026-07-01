/** Classify live alert cards for fatigue vs distraction triage actions. */

export type CameraAlertEventKind = "fatigue" | "distraction" | "unknown";

export function cameraAlertEventKind(args: {
  displayName?: string | null;
  fatigueMetricType?: string | null;
}): CameraAlertEventKind {
  const metric = args.fatigueMetricType?.trim().toUpperCase();
  if (metric === "DISTRACTION") return "distraction";
  if (metric === "FATIGUE") return "fatigue";

  const name = (args.displayName ?? "").trim().toLowerCase();
  if (name.includes("distraction")) return "distraction";
  if (name.includes("fatigue")) return "fatigue";
  return "unknown";
}

export function showVerifiedFatigueAction(kind: CameraAlertEventKind): boolean {
  return kind === "fatigue" || kind === "unknown";
}

export function showVerifiedDistractionAction(kind: CameraAlertEventKind): boolean {
  return kind === "distraction" || kind === "unknown";
}
