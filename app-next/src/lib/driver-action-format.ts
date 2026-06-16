/** Countdown and work-window helpers for the driver primary action button. */

export function getRemainingWindowMinutes(
  workMinutesUsed: number,
  totalWindowMinutes: number
): number {
  if (!Number.isFinite(totalWindowMinutes) || totalWindowMinutes <= 0) return 0;
  const used =
    !Number.isFinite(workMinutesUsed) || workMinutesUsed < 0
      ? 0
      : Math.min(workMinutesUsed, totalWindowMinutes);
  return Math.max(0, totalWindowMinutes - used);
}

export function formatComplianceCountdown(remainingMinutes: number): string {
  const mins = Math.max(0, Math.ceil(remainingMinutes));
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function getWorkWindowStatusLabel(remainingMinutes: number): string {
  if (!Number.isFinite(remainingMinutes) || remainingMinutes <= 15) return "BREAK REQUIRED NOW";
  if (remainingMinutes <= 45) return "BREAK DUE SOON";
  return "WORK WINDOW LEFT";
}
