import { randomUUID } from "crypto";
import { apiErrorResponse, CommandApiError } from "@/lib/errors";
import { getSession } from "@/lib/auth/session";
import { withServiceContext } from "@/lib/privileged-db";

function simulateAllowedInProduction(session: NonNullable<Awaited<ReturnType<typeof getSession>>>): boolean {
  if (process.env.COMMAND_ALLOW_SIMULATE === "true") return true;
  return session.role === "command_owner" || session.role === "command_operator";
}

/** Dev MVP: simulate Pi edge insert (requires SQL trigger 003 on Neon). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json(
      { error: "ERR_TOKEN_EXPIRED", message: "Sign in required to simulate ingest." },
      { status: 401 }
    );
  }

  if (process.env.NODE_ENV === "production" && !simulateAllowedInProduction(session)) {
    return Response.json(
      {
        error: "ERR_FORBIDDEN",
        message: "Simulate ingest is disabled in production for this account.",
      },
      { status: 403 }
    );
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
          fatigueMetricType: "FATIGUE",
          confidenceScore: 0.94,
          videoSnippetUrl: `https://media.circadia24.com/clips/sim-${Date.now()}.mp4`,
        },
        include: { lifecycle: true },
      })
    );

    if (!event.lifecycle) {
      throw new CommandApiError(
        "ERR_LIFECYCLE_TRIGGER",
        "Edge event created but no lifecycle row — apply prisma/sql/003_edge_ingress_triggers.sql on Neon.",
        503
      );
    }

    return Response.json({
      event_id: event.eventId,
      lifecycle_id: event.lifecycle.lifecycleId,
      vehicle_registration: rego,
      note: "Lifecycle row created (trigger active).",
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
