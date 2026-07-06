import { Client } from "pg";
import { getSession } from "@/lib/auth/session";
import { getDirectDatabaseUrl } from "@/lib/db-direct-url";
import { dispatchNewIncidentPush } from "@/lib/push-notifications";
import { withOperatorContext } from "@/lib/privileged-db";
import { fetchIncidentForSse } from "@/lib/sse/incident-payload";
import { formatSseMessage, SSE_HEADERS } from "@/lib/sse/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HEARTBEAT_MS = Number(process.env.ENGINE_HEARTBEAT_INTERVAL_MS ?? 15000);

type NotifyPayload = {
  event: string;
  lifecycle_id: string;
  event_status?: string;
  operator_id?: string;
};

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "ERR_TOKEN_EXPIRED" }), { status: 401 });
  }

  const operatorId = session.sub;
  const lastEventId = new URL(request.url).searchParams.get("lastEventId");

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const encoder = new TextEncoder();
      let closed = false;

      const push = (id: string, event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(formatSseMessage(id, event, data)));
      };

      const closeAll = async (client?: Client) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          await client?.end();
        } catch {
          /* ignore */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      if (lastEventId) {
        try {
          const missed = await withOperatorContext(operatorId, async (tx) => {
            const anchor = await tx.fatigueIncidentLifecycle.findUnique({
              where: { lifecycleId: lastEventId },
              select: { detectedAt: true },
            });
            if (!anchor) return [];

            const rows = await tx.fatigueIncidentLifecycle.findMany({
              where: {
                eventStatus: "PENDING_TRIAGE",
                detectedAt: { gt: anchor.detectedAt },
              },
              orderBy: { detectedAt: "asc" },
              take: 50,
            });

            const incidents = [];
            for (const row of rows) {
              const inc = await fetchIncidentForSse(tx, row.lifecycleId);
              if (inc) incidents.push(inc);
            }
            return incidents;
          });

          for (const inc of missed) {
            push(inc.lifecycle_id, "INCIDENT_NEW", inc);
          }
        } catch (err) {
          console.error("SSE catchup failed", err);
        }
      }

      const pg = new Client({ connectionString: getDirectDatabaseUrl() });

      const heartbeat = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_MS);

      try {
        await pg.connect();
        await pg.query("LISTEN channel_live_fatigue_events");

        pg.on("notification", (msg) => {
          if (!msg.payload) return;
          void (async () => {
            try {
              const payload = JSON.parse(msg.payload!) as NotifyPayload;

              if (payload.event === "DRIVER_RESPONSE") {
                push(payload.lifecycle_id, "DRIVER_RESPONSE", {
                  lifecycle_id: payload.lifecycle_id,
                  event_status: payload.event_status ?? "DRIVER_ACKNOWLEDGED",
                });
                return;
              }

              if (payload.event === "INCIDENT_CLAIMED") {
                push(payload.lifecycle_id, "INCIDENT_CLAIMED", {
                  lifecycle_id: payload.lifecycle_id,
                  operator_id: payload.operator_id,
                });
                return;
              }

              if (payload.event === "INCIDENT_CLOSED") {
                push(payload.lifecycle_id, "INCIDENT_CLOSED", {
                  lifecycle_id: payload.lifecycle_id,
                  event_status: payload.event_status,
                });
                return;
              }

              const incident = await withOperatorContext(operatorId, (tx) =>
                fetchIncidentForSse(tx, payload.lifecycle_id)
              );
              if (!incident) return;

              if (payload.event === "INCIDENT_NEW") {
                void dispatchNewIncidentPush({
                  lifecycleId: incident.lifecycle_id,
                  vehicleRegistration: incident.vehicle_registration,
                  fatigueMetricType: incident.fatigue_metric_type,
                  detectedAt: incident.detected_at,
                });
              }

              push(payload.lifecycle_id, payload.event, incident);
            } catch (err) {
              console.error("SSE notify handler failed", err);
            }
          })();
        });
      } catch (err) {
        console.error("SSE LISTEN failed", err);
        push("error", "STREAM_ERROR", {
          message: "Live stream unavailable; falling back to polling.",
        });
        await closeAll(pg);
        return;
      }

      request.signal.addEventListener("abort", () => {
        void closeAll(pg);
      });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
