import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import {
  completeOperatorVerifiedDistraction,
  releaseTriageClaim,
} from "@/lib/complete-resolution";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";
import { getSession } from "@/lib/auth/session";
import { assertOperatorOnShift } from "@/lib/triage-shift";
import { requireVerifiedDistractionReasons } from "@/lib/verified-distraction-reasons";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const session = await getSession();
    const body = (await request.json()) as {
      lifecycle_id?: string;
      verified_distraction_reasons?: string[];
      note?: string | null;
      idempotency_key?: string;
    };

    if (!body.lifecycle_id || !body.idempotency_key) {
      throw new CommandApiError(
        "ERR_MALFORMED_PAYLOAD",
        "lifecycle_id and idempotency_key are required.",
        400
      );
    }

    let verifiedDistractionReasons;
    try {
      verifiedDistractionReasons = requireVerifiedDistractionReasons(body.verified_distraction_reasons);
    } catch (e) {
      if (e instanceof Error && e.message === "VERIFIED_DISTRACTION_REASONS_REQUIRED") {
        throw new CommandApiError(
          "ERR_MALFORMED_PAYLOAD",
          "Select at least one verified distraction trigger reason.",
          400
        );
      }
      throw e;
    }

    await assertOperatorOnShift(prisma, operatorId);

    const result = await withOperatorContext(operatorId, async (tx) =>
      completeOperatorVerifiedDistraction(tx, {
        lifecycleId: body.lifecycle_id!,
        operatorId,
        operatorName: session?.name ?? "Command operator",
        verifiedDistractionReasons,
        note: body.note,
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
