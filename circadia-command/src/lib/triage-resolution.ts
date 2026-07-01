/**
 * Verified-fatigue resolution actions — Command operator triage (§3.5.4).
 */

export const INCIDENT_RESOLUTION_CATEGORIES = ["Driver", "Manager", "Other"] as const;

export type IncidentResolutionCategory = (typeof INCIDENT_RESOLUTION_CATEGORIES)[number];

export const INCIDENT_RESOLUTION_ACTIONS = [
  {
    value: "driver_contacted_confirmed_ok",
    category: "Driver",
    label: "Driver - contacted by phone, confirmed ok",
  },
  {
    value: "driver_contacted_rest_20min_next_stop",
    category: "Driver",
    label:
      "Driver - contacted by phone, asked to pull into next stop and rest for 20 minute break",
  },
  {
    value: "driver_contacted_pull_over_long_break",
    category: "Driver",
    label:
      "Driver - contacted by phone, instructed to pull over and have longer than 20 minute break",
  },
  {
    value: "driver_contacted_7h_break",
    category: "Driver",
    label: "Driver - contacted by phone, instructed to have 7 hour break",
  },
  {
    value: "driver_no_contact",
    category: "Driver",
    label: "Driver - not able to make contact",
  },
  {
    value: "manager_contacted_accepted_handover",
    category: "Manager",
    label: "Manager - contacted about driver event, they accepted handover",
  },
  {
    value: "manager_contacted_disagreed_accepted_handover",
    category: "Manager",
    label:
      "Manager - contacted about driver event, disagreed with event classification, they accept handover",
  },
  {
    value: "manager_no_contact",
    category: "Manager",
    label: "Manager - not able to make contact",
  },
  {
    value: "other_outcome",
    category: "Other",
    label: "Other - make note of other outcome",
  },
] as const satisfies ReadonlyArray<{
  value: string;
  category: IncidentResolutionCategory;
  label: string;
}>;

export type IncidentResolutionActionType =
  (typeof INCIDENT_RESOLUTION_ACTIONS)[number]["value"];

const ACTION_VALUES = new Set<string>(INCIDENT_RESOLUTION_ACTIONS.map((a) => a.value));

export function isIncidentResolutionActionType(value: string): value is IncidentResolutionActionType {
  return ACTION_VALUES.has(value);
}

export function resolutionActionLabel(actionType: string): string {
  if (actionType === "verified_distraction") return "Verified distraction";
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
