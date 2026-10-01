import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import {
  actionRecordsDownloadName,
  buildActionRecordsCsv,
  buildActionRecordsVideoZip,
  fetchActionRecords,
  parseActionRecordPack,
  parseActionRecordWindow,
} from "@/lib/action-records-publish";
import { requireOperatorId } from "@/lib/operator-context";
import { withOperatorContext } from "@/lib/privileged-db";

export const runtime = "nodejs";

function parseOrBadRequest<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request.";
    throw new CommandApiError("ERR_VALIDATION", message, 400);
  }
}

export async function GET(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const { searchParams } = new URL(request.url);
    const window = parseOrBadRequest(() => parseActionRecordWindow(searchParams.get("window")));
    const previewOnly = searchParams.get("preview") === "1";

    const preview = await withOperatorContext(operatorId, (tx) => fetchActionRecords(tx, window));

    if (previewOnly) {
      return Response.json(preview);
    }

    const pack = parseOrBadRequest(() => parseActionRecordPack(searchParams.get("pack")));
    const filename = actionRecordsDownloadName(pack, window);

    if (pack === "list") {
      const csv = buildActionRecordsCsv(preview.records);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const zip = buildActionRecordsVideoZip(preview);
    return new Response(Buffer.from(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
