import { dispatchNewIncidentPush, type PushIncidentPayload } from "@/lib/push-notifications";

const TEST_INCIDENT_SECRET_HEADER = "x-test-incident-secret";

function authorize(request: Request): boolean {
  const secret = process.env.TEST_INCIDENT_INTERNAL_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get(TEST_INCIDENT_SECRET_HEADER) === secret;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<PushIncidentPayload>;
  if (
    !body.lifecycleId ||
    !body.vehicleRegistration ||
    !body.fatigueMetricType ||
    !body.detectedAt
  ) {
    return Response.json({ message: "lifecycleId, vehicleRegistration, fatigueMetricType, detectedAt required" }, {
      status: 400,
    });
  }

  await dispatchNewIncidentPush({
    lifecycleId: body.lifecycleId,
    vehicleRegistration: body.vehicleRegistration,
    fatigueMetricType: body.fatigueMetricType,
    detectedAt: body.detectedAt,
  });

  return Response.json({ ok: true });
}
