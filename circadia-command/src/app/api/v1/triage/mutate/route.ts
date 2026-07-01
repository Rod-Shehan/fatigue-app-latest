import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { requireFalsePositiveReasonsForDismiss } from "@/lib/false-positive-reasons";
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
      false_positive_reasons?: string[];
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

    let falsePositiveReasons;
    try {
      falsePositiveReasons = requireFalsePositiveReasonsForDismiss(
        body.action,
        body.false_positive_reasons
      );
    } catch (e) {
      if (e instanceof Error && e.message === "FALSE_POSITIVE_REASONS_REQUIRED") {
        throw new CommandApiError(
          "ERR_MALFORMED_PAYLOAD",
          "Select at least one false positive trigger reason.",
          400
        );
      }
      throw e;
    }

    const result = await withOperatorContext(operatorId, async (tx) =>
      applyOperatorTriageAction(tx, {
        lifecycleId: body.lifecycle_id!,
        action: body.action as TriageAction,
        operatorId,
        operatorNotes: body.operator_notes,
        falsePositiveReasons:
          body.action === "VERIFIED_FALSE_POSITIVE" ? falsePositiveReasons : undefined,
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
