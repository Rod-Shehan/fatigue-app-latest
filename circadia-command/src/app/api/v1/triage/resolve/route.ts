import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { isIncidentResolutionActionType } from "@/lib/triage-resolution";
import { completeOperatorResolution, releaseTriageClaim } from "@/lib/complete-resolution";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";
import { getSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const session = await getSession();
    const body = (await request.json()) as {
      lifecycle_id?: string;
      action_type?: string;
      resolution_notes?: string | null;
      idempotency_key?: string;
    };

    if (!body.lifecycle_id || !body.action_type || !body.idempotency_key) {
      throw new CommandApiError(
        "ERR_MALFORMED_PAYLOAD",
        "lifecycle_id, action_type, and idempotency_key are required.",
        400
      );
    }
    const actionType = body.action_type;
    if (!isIncidentResolutionActionType(actionType)) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Invalid action_type.", 400);
    }

    const result = await withOperatorContext(operatorId, async (tx) =>
      completeOperatorResolution(tx, {
        lifecycleId: body.lifecycle_id!,
        operatorId,
        operatorName: session?.name ?? "Command operator",
        actionType,
        resolutionNotes: body.resolution_notes,
        idempotencyKey: body.idempotency_key!,
      })
    );

    return Response.json({
      lifecycle_id: body.lifecycle_id,
      status: result.status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const body = (await request.json()) as { lifecycle_id?: string };
    if (!body.lifecycle_id) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "lifecycle_id is required.", 400);
    }

    const released = await withOperatorContext(operatorId, async (tx) =>
      releaseTriageClaim(tx, { lifecycleId: body.lifecycle_id!, operatorId })
    );

    if (!released) {
      throw new CommandApiError(
        "ERR_STATE_CONCURRENCY_VIOLATION",
        "Could not release claim for this incident.",
        409
      );
    }

    return Response.json({ ok: true, lifecycle_id: body.lifecycle_id });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
