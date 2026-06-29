import { getSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { buildOperatorOnShift, getTriageShiftSnapshot } from "@/lib/triage-shift";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/triage/shift/current — shared shift banner for Command triage. */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "ERR_UNAUTHORIZED", message: "Sign in required." }, { status: 401 });
    }

    const snapshot = await getTriageShiftSnapshot(prisma);
    const viewer = buildOperatorOnShift(snapshot, session.sub);

    return Response.json({ snapshot, viewer });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
