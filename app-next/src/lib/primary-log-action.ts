export type PrimaryLogAction = {
  /** The event type to be logged if the primary action is tapped. */
  type: "work" | "break" | "non_work";
  /** Button label shown when not in countdown mode. */
  label: string;
  /** Optional helper line for rest/blocks. */
  helper?: string | null;
};

/**
 * Phase B1: resolve the primary action in the "idle" state (no current open work/break segment).
 * If the driver has not yet met 7h continuous non-work, primary becomes Continue rest.
 */
export function resolveIdlePrimaryLogAction(options: {
  restRunMinutes: number;
  minRestMinutes: number;
}): PrimaryLogAction {
  const { restRunMinutes, minRestMinutes } = options;
  if (restRunMinutes < minRestMinutes) {
    const remaining = Math.max(0, minRestMinutes - restRunMinutes);
    const hrs = Math.floor(remaining / 60);
    const mins = remaining % 60;
    const remainingLabel = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    return {
      type: "non_work",
      label: "Continue rest",
      helper: `7h rest required · ${remainingLabel} remaining`,
    };
  }
  return { type: "work", label: "Start shift", helper: null };
}

