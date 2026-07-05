import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeTestIncidentRequest } from "@/lib/integrations/test-incident-auth";
import { purgeTestIncidents } from "@/lib/integrations/test-incident";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await authorizeTestIncidentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const result = await purgeTestIncidents(prisma);
  return NextResponse.json({
    ok: true,
    ...result,
    message:
      result.ingestRowsDeleted > 0
        ? `Purged ${result.ingestRowsDeleted} test ingest row(s).`
        : "No test incidents to purge.",
  });
}
