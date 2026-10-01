import { apiErrorResponse } from "@/lib/errors";
import { listFleetDriverNames } from "@/lib/event-driver-name";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";

export async function GET() {
  try {
    const operatorId = await requireOperatorId();
    const drivers = await withOperatorContext(operatorId, (tx) => listFleetDriverNames(tx));
    return Response.json({ drivers });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
