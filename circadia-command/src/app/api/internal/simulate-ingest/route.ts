import { randomUUID } from "crypto";
import { apiErrorResponse } from "@/lib/errors";
import { withServiceContext } from "@/lib/privileged-db";

/** Dev MVP: simulate Pi edge insert (requires SQL trigger 003 on Neon). */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.COMMAND_ALLOW_SIMULATE !== "true") {
    return Response.json({ error: "ERR_FORBIDDEN" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      tenant_id_uuid?: string;
      driver_id_uuid?: string;
      vehicle_registration?: string;
    };

    const tenantId = body.tenant_id_uuid ?? process.env.COMMAND_PILOT_TENANT_ID_UUID ?? randomUUID();
    const driverId = body.driver_id_uuid ?? randomUUID();
    const rego = body.vehicle_registration ?? `SIM${Math.floor(Math.random() * 900 + 100)}`;

    const event = await withServiceContext(async (tx) =>
      tx.edgeFatigueEvent.create({
        data: {
          tenantIdUuid: tenantId,
          driverIdUuid: driverId,
          vehicleRegistration: rego,
          hardwareTimestamp: new Date(),
          speedKmh: 82.5,
          headingDegrees: 214,
          laneDeviationIndex: 0.42,
          brakingPressurePsi: 0,
          aiModelVersion: "yolov8n-circadia-dev",
          fatigueMetricType: "MICROSLEEP",
          confidenceScore: 0.94,
          videoSnippetUrl: `https://media.circadia24.com/clips/sim-${Date.now()}.mp4`,
        },
        include: { lifecycle: true },
      })
    );

    return Response.json({
      event_id: event.eventId,
      lifecycle_id: event.lifecycle?.lifecycleId ?? null,
      vehicle_registration: rego,
      note: event.lifecycle
        ? "Lifecycle row created (trigger active)."
        : "No lifecycle row — apply prisma/sql/003_edge_ingress_triggers.sql",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
