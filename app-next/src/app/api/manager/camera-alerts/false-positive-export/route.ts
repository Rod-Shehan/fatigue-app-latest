import { NextResponse } from "next/server";
import { getManagerSession } from "@/lib/auth";
import {
  buildFalsePositiveExportCsv,
  listFalsePositiveExportRows,
} from "@/lib/integrations/false-positive-export";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/manager/camera-alerts/false-positive-export?hours=168
 * CSV export of dismissed false-positive capture (Excel-friendly).
 */
export async function GET(request: Request) {
  const manager = await getManagerSession();
  if (!manager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const hoursRaw = Number(searchParams.get("hours") ?? "168");
  const hours = Number.isFinite(hoursRaw) ? Math.min(Math.max(hoursRaw, 1), 720) : 168;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const rows = await listFalsePositiveExportRows(prisma, { since });
  const csv = buildFalsePositiveExportCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="false-positive-capture-${stamp}.csv"`,
    },
  });
}
