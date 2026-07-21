import { apiErrorResponse } from "@/lib/errors";
import { requireOperatorId } from "@/lib/operator-context";
import { fetchMapEvents, fetchMapSheetMeta } from "@/lib/map-events";

/**
 * GET /api/v1/map-events
 * Query: weekStarting?, driverName?, meta=1 (filter options only)
 * Returns GPS logbook events from shared FatigueSheet for Event Tracker.
 */
export async function GET(request: Request) {
  try {
    await requireOperatorId();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("meta") === "1") {
      const sheets = await fetchMapSheetMeta();
      return Response.json({ sheets });
    }

    const weekStarting = searchParams.get("weekStarting") ?? undefined;
    const driverName = searchParams.get("driverName") ?? undefined;
    const result = await fetchMapEvents({ weekStarting, driverName });
    return Response.json(result);
  } catch (e) {
    return apiErrorResponse(e);
  }
}
