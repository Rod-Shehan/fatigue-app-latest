import type { PrismaClient } from "@prisma/client";
import { dateToYmd } from "@/lib/cvd-medical";

export type RosterPdfIdentity = {
  licenceNumber: string | null;
  medicalExpiryYmd: string | null;
  licenceExpiryYmd: string | null;
};

const EMPTY_ROSTER_PDF_IDENTITY: RosterPdfIdentity = {
  licenceNumber: null,
  medicalExpiryYmd: null,
  licenceExpiryYmd: null,
};

/** Match the sheet driver name to the tenant roster (case-insensitive), same as sheet banners. */
export async function findRosterPdfIdentity(
  prisma: PrismaClient,
  tenantId: string,
  driverName: string | null | undefined
): Promise<RosterPdfIdentity> {
  const name = (driverName || "").trim();
  if (!name || !tenantId) return EMPTY_ROSTER_PDF_IDENTITY;
  const match = await prisma.driver.findFirst({
    where: { tenantId, name: { equals: name, mode: "insensitive" } },
    select: { licenceNumber: true, cvdMedicalExpiry: true, licenceExpiry: true },
  });
  if (!match) return EMPTY_ROSTER_PDF_IDENTITY;
  return {
    licenceNumber: match.licenceNumber,
    medicalExpiryYmd: dateToYmd(match.cvdMedicalExpiry),
    licenceExpiryYmd: dateToYmd(match.licenceExpiry),
  };
}
