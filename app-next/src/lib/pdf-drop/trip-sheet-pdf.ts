import type { PrismaClient } from "@prisma/client";
import { jurisdictionDisplayLabel, parseJurisdictionCode } from "@/lib/jurisdiction";
import { getPerthNowParts } from "@/lib/perth-now";
import { weekTripSheetDropPath } from "@/lib/pdf-drop/filename";
import { findRosterPdfIdentity } from "@/lib/roster-driver-pdf";
import { buildSingleSheetJsPdfBuffer } from "@/lib/sheet-jspdf-export";

function parseDaysJson(raw: string | null | undefined) {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function buildWeekTripSheetDropFile(
  prisma: PrismaClient,
  row: {
    id: string;
    tenantId: string;
    driverName: string;
    secondDriver: string | null;
    driverType: string;
    weekStarting: string;
    days: string;
    status: string;
    signature: string | null;
    signedAt: Date | null;
    jurisdictionCode: string;
    last24hBreak: string | null;
    last24hRest1: string | null;
    last24hRest2: string | null;
    last24hRest3: string | null;
    last24hRest4: string | null;
    tenant: { legalName: string; slug: string };
  }
) {
  const roster = await findRosterPdfIdentity(prisma, row.tenantId, row.driverName);
  const sheet = {
    driver_name: row.driverName,
    second_driver: row.secondDriver,
    driver_type: row.driverType,
    week_starting: row.weekStarting,
    days: parseDaysJson(row.days) as Array<Record<string, unknown>>,
    status: row.status,
    signature: row.signature,
    signed_at: row.signedAt?.toISOString() ?? null,
    jurisdiction_label: jurisdictionDisplayLabel(parseJurisdictionCode(row.jurisdictionCode)),
    last_24h_break: row.last24hBreak,
    last_24h_rest_1: row.last24hRest1,
    last_24h_rest_2: row.last24hRest2,
    last_24h_rest_3: row.last24hRest3,
    last_24h_rest_4: row.last24hRest4,
    operator_legal_name: row.tenant.legalName,
    driver_licence_number: roster.licenceNumber,
    driver_medical_expiry: roster.medicalExpiryYmd,
    driver_licence_expiry: roster.licenceExpiryYmd,
  };
  const pdfBytes = await buildSingleSheetJsPdfBuffer({
    sheet,
    todayStr: getPerthNowParts().ymd,
    generatedAtLabel: new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth" }),
    layout: "tripSheetOnly",
  });
  return {
    relativePath: weekTripSheetDropPath({
      legalName: row.tenant.legalName,
      slug: row.tenant.slug,
      weekStarting: row.weekStarting,
      driverName: row.driverName,
    }),
    bytes: new Uint8Array(pdfBytes),
    contentType: "application/pdf",
  };
}
