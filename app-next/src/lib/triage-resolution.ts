/**
 * Verified-fatigue resolution actions — shared labels (§3.5.4).
 */

export const INCIDENT_RESOLUTION_ACTIONS = [
  { value: "call_driver", label: "Phoned Driver" },
  { value: "request_rest_break", label: "Ordered Rest Break" },
  { value: "scheduled_stand_down", label: "Scheduled Stand-down" },
  { value: "toolboxed", label: "Toolboxed" },
] as const;

export type IncidentResolutionActionType =
  (typeof INCIDENT_RESOLUTION_ACTIONS)[number]["value"];

const ACTION_VALUES = new Set<string>(INCIDENT_RESOLUTION_ACTIONS.map((a) => a.value));

export function isIncidentResolutionActionType(value: string): value is IncidentResolutionActionType {
  return ACTION_VALUES.has(value);
}

export function resolutionActionLabel(actionType: IncidentResolutionActionType): string {
  return INCIDENT_RESOLUTION_ACTIONS.find((a) => a.value === actionType)?.label ?? actionType;
}

export function formatResolutionAuditNote(
  actionType: IncidentResolutionActionType,
  resolutionNotes: string | null | undefined
): string {
  const label = resolutionActionLabel(actionType);
  const notes = resolutionNotes?.trim();
  return notes ? `${label} — ${notes}` : label;
}
