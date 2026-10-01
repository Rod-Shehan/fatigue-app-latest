import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { setIncidentDriverName } from "@/lib/event-driver-name";
import { getSession } from "@/lib/auth/session";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";

export async function POST(
  request: Request,
  context: { params: Promise<{ lifecycleId: string }> }
) {
  try {
    const operatorId = await requireOperatorId();
    const session = await getSession();
    const { lifecycleId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { driver_name?: string };
    if (!lifecycleId) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "lifecycle_id is required.", 400);
    }

    const driverName = await withOperatorContext(operatorId, (tx) =>
      setIncidentDriverName(tx, {
        lifecycleId,
        driverName: body.driver_name ?? "",
        operatorId,
        operatorName: session?.name ?? "Command operator",
      })
    );

    return Response.json({ lifecycle_id: lifecycleId, driver_name: driverName });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
