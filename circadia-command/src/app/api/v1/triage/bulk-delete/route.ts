import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import {
  COMMAND_BULK_DELETE_MAX,
  deleteNoVideoIncidents,
} from "@/lib/delete-no-video-incidents";
import { requireOperatorId } from "@/lib/operator-context";
import { withServiceContext } from "@/lib/privileged-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    await requireOperatorId();
    const body = (await request.json().catch(() => ({}))) as {
      lifecycle_ids?: unknown;
      playback_failed_ids?: unknown;
    };
    const rawIds = Array.isArray(body.lifecycle_ids) ? body.lifecycle_ids : [];
    const lifecycleIds = rawIds.filter((id): id is string => typeof id === "string" && UUID_RE.test(id.trim()));
    const playbackFailedIds = (
      Array.isArray(body.playback_failed_ids) ? body.playback_failed_ids : []
    ).filter((id): id is string => typeof id === "string" && UUID_RE.test(id.trim()));

    if (lifecycleIds.length === 0) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Select events with no video to remove.", 400);
    }
    if (lifecycleIds.length > COMMAND_BULK_DELETE_MAX) {
      throw new CommandApiError(
        "ERR_MALFORMED_PAYLOAD",
        `Remove at most ${COMMAND_BULK_DELETE_MAX} events at a time.`,
        400
      );
    }

    const result = await withServiceContext((tx) =>
      deleteNoVideoIncidents(tx, lifecycleIds, playbackFailedIds)
    );

    if (result.deleted.length === 0 && result.skippedHasVideo.length > 0) {
      throw new CommandApiError(
        "ERR_HAS_VIDEO",
        "Those events have a video clip and were left on the desk.",
        409
      );
    }

    return Response.json({
      ok: true,
      deleted: result.deleted.length,
      skipped_has_video: result.skippedHasVideo,
      not_found: result.notFound,
      failed: result.failed,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
