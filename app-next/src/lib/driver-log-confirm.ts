/**
 * In-cab double-tap confirm for Work / Break / End shift / Start shift.
 * Pending must be readable synchronously (ref) so a rapid second tap before
 * React re-renders still commits the event.
 */

export const DRIVER_LOG_CONFIRM_WINDOW_MS = 8_000;

export type DriverLogConfirmArm = {
  type: string;
  episodeResume: boolean;
};

export function isDriverLogConfirmMatch(
  armed: DriverLogConfirmArm | null | undefined,
  type: string,
  episodeResume: boolean
): boolean {
  return (
    armed != null && armed.type === type && armed.episodeResume === episodeResume
  );
}
