import type { PrismaClient } from "@prisma/client";
import { putClientDropFile, type PdfDropClient } from "@/lib/pdf-drop";
import { buildWeekTripSheetDropFile } from "@/lib/pdf-drop/trip-sheet-pdf";

const WEEK_START = /^\d{4}-\d{2}-\d{2}$/;

export function parseWeekStarting(raw: unknown): string | null {
  if (typeof raw !== "string" || !WEEK_START.test(raw.trim())) return null;
  return raw.trim();
}

export async function dropSignedWeekTripSheets(
  prisma: PrismaClient,
  client: PdfDropClient,
  weekStarting: string
): Promise<{ dropped: number; skippedUnsigned: number; files: { path: string; webUrl: string | null }[] }> {
  const sheets = await prisma.fatigueSheet.findMany({
    where: { tenantId: client.tenantId, weekStarting },
    include: { tenant: { select: { legalName: true, slug: true } } },
    orderBy: { driverName: "asc" },
  });
  const unsigned = sheets.filter((s) => !s.signedAt).length;
  const signed = sheets.filter((s) => s.signedAt);
  const files: { path: string; webUrl: string | null }[] = [];

  for (const row of signed) {
    const file = await buildWeekTripSheetDropFile(prisma, row);
    const put = await putClientDropFile(client, file);
    files.push({ path: file.relativePath, webUrl: put.webUrl });
  }

  return { dropped: files.length, skippedUnsigned: unsigned, files };
}
