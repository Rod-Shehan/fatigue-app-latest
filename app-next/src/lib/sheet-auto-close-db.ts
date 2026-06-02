/**
 * Past weeks stay draft until the driver signs (time archive enforced in UI/API).
 * No auto-complete without signature — that would bypass driver attestation.
 */
export async function autoCloseStaleDraftSheetsForUser(_userId: string): Promise<number> {
  void _userId;
  return 0;
}
