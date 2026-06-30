import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { TRIAGE_ACTIONS, type TriageAction } from "@/lib/lifecycle-status";
import { applyOperatorTriageAction } from "@/lib/manager-gate";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";
import { assertOperatorOnShift } from "@/lib/triage-shift";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const body = (await request.json()) as {
      lifecycle_id?: string;
      action?: string;
      idempotency_key?: string;
      operator_notes?: string;
    };

    if (!body.lifecycle_id || !body.action || !body.idempotency_key) {
      throw new CommandApiError(
        "ERR_MALFORMED_PAYLOAD",
        "lifecycle_id, action, and idempotency_key are required.",
        400
      );
    }
    if (!TRIAGE_ACTIONS.includes(body.action as TriageAction)) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Invalid triage action.", 400);
    }

    await assertOperatorOnShift(prisma, operatorId);

    const result = await withOperatorContext(operatorId, async (tx) =>
      applyOperatorTriageAction(tx, {
        lifecycleId: body.lifecycle_id!,
        action: body.action as TriageAction,
        operatorId,
        operatorNotes: body.operator_notes,
        idempotencyKey: body.idempotency_key!,
      })
    );

    return Response.json({
      lifecycle_id: body.lifecycle_id,
      status_transitioned_to: result.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
