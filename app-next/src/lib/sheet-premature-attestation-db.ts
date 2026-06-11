import type { PrismaClient } from "@prisma/client";
import { isPrematureCurrentWeekAttestation, PREMATURE_ATTESTATION_REOPEN } from "@/lib/sheet-record";

type SheetAttestationRow = {
  id: string;
  weekStarting: string;
  status: string;
  signature: string | null;
};

/** Reopen a current-week sheet that was signed before the week ended. */
export async function reopenPrematureCurrentWeekAttestationIfNeeded<T extends SheetAttestationRow>(
  prisma: PrismaClient,
  sheet: T,
  actorId: string | null
): Promise<T> {
  if (
    !isPrematureCurrentWeekAttestation(sheet.weekStarting, sheet.status, sheet.signature)
  ) {
    return sheet;
  }

  const updated = await prisma.fatigueSheet.update({
    where: { id: sheet.id },
    data: PREMATURE_ATTESTATION_REOPEN,
  });

  await prisma.auditEvent.create({
    data: {
      sheetId: sheet.id,
      actorId,
      action: "reopen_premature_attestation",
      payload: {
        reason:
          "Current regulatory week was signed before week end; reopened automatically so logging can continue.",
        week_starting: sheet.weekStarting,
        status_before: sheet.status,
        had_signature_before: !!sheet.signature,
      },
    },
  });

  return updated as T;
}
