import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";

export async function POST(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const body = (await request.json()) as { lifecycle_id?: string; idempotency_key?: string };
    if (!body.lifecycle_id) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "lifecycle_id is required.", 400);
    }

    const claim = await withOperatorContext(operatorId, async (tx) => {
      const updated = await tx.fatigueIncidentLifecycle.updateMany({
        where: { lifecycleId: body.lifecycle_id, operatorId: null },
        data: { operatorId },
      });
      if (updated.count === 0) {
        const existing = await tx.fatigueIncidentLifecycle.findUnique({
          where: { lifecycleId: body.lifecycle_id },
          include: { operator: true },
        });
        if (!existing) {
          throw new CommandApiError("ERR_NOT_FOUND", "Incident not found.", 404);
        }
        throw new CommandApiError(
          "ERR_INCIDENT_ALREADY_CLAIMED",
          "This safety event has already been claimed by another operations seat.",
          409
        );
      }
      return { lifecycle_id: body.lifecycle_id, operator_id: operatorId };
    });

    return Response.json(claim);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
