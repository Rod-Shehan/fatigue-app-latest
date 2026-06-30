import { apiErrorResponse, CommandApiError } from "@/lib/errors";
import { fetchIncidentActivityTimeline } from "@/lib/incident-activity-timeline";
import { requireOperatorId } from "@/lib/operator-context";

export async function GET(
  _request: Request,
  context: { params: Promise<{ lifecycleId: string }> }
) {
  try {
    await requireOperatorId();
    const { lifecycleId } = await context.params;
    if (!lifecycleId) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "lifecycleId is required.", 400);
    }

    const { prisma } = await import("@/lib/prisma");
    const entries = await fetchIncidentActivityTimeline(prisma, lifecycleId);
    return Response.json({ entries });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
