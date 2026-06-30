import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { claimIncidentForOperator } from "@/lib/incident-claim";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";
import { getSession } from "@/lib/auth/session";
import { buildOperatorOnShift, getTriageShiftSnapshot } from "@/lib/triage-shift";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const session = await getSession();
    const body = (await request.json()) as { lifecycle_id?: string; idempotency_key?: string };
    if (!body.lifecycle_id) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "lifecycle_id is required.", 400);
    }

    const snapshot = await getTriageShiftSnapshot(prisma);
    const viewer = buildOperatorOnShift(snapshot, operatorId);
    if (!viewer.onShift) {
      throw new CommandApiError(
        "ERR_NOT_ON_SHIFT",
        "You are not on triage shift.",
        403
      );
    }

    const claim = await withOperatorContext(operatorId, async (tx) =>
      claimIncidentForOperator(tx, {
        lifecycleId: body.lifecycle_id!,
        operatorId,
        operatorName: session?.name ?? "Command operator",
      })
    );

    return Response.json(claim);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
