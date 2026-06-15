import { apiErrorResponse } from "@/lib/errors";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";
import {
  countPendingTriage,
  decodeCursor,
  encodeCursor,
  fetchTriageQueue,
} from "@/lib/triage-queue";

export async function GET(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const cursor = decodeCursor(searchParams.get("cursor"));

    const result = await withOperatorContext(operatorId, async (tx) => {
      const [queue, queueDepth] = await Promise.all([
        fetchTriageQueue(tx, limit, cursor),
        countPendingTriage(tx),
      ]);
      return { queue, queueDepth };
    });

    const last = result.queue.incidents.at(-1);
    const nextCursor =
      result.queue.hasMore && last
        ? encodeCursor({ lastTime: last.detected_at, lastId: last.lifecycle_id })
        : null;

    return Response.json({
      queue_depth: result.queueDepth,
      incidents: result.queue.incidents,
      pagination: {
        next_cursor: nextCursor,
        has_more: result.queue.hasMore,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
