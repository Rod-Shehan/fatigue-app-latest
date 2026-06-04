import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, getSessionForSheetAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateRiskBlockUploadBatch } from "@/lib/camera-risk-packet";
import { ingestDriverRiskBlockBatch } from "@/lib/risk-block-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/driver/risk-blocks
 * Batch upload of 15-minute camera (+ optional diary) blocks from driver device.
 * Idempotent on upload_id per user. Safe for blackspot flush replays.
 */
export async function POST(req: NextRequest) {
  const access = await getSessionForSheetAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (access.isManager) {
    return NextResponse.json({ error: "Use the driver account for camera uploads." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateRiskBlockUploadBatch(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const driverName =
    (session?.user && "name" in session.user && session.user.name) ||
    access.session.user?.name ||
    "Driver";

  try {
    const result = await ingestDriverRiskBlockBatch(prisma, {
      userId: access.userId,
      driverName: String(driverName),
      items: validated.batch.blocks,
    });

    return NextResponse.json({
      ok: true,
      accepted: result.accepted,
      skipped: result.skipped,
      results: result.results,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
