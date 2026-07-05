import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeTestIncidentRequest } from "@/lib/integrations/test-incident-auth";
import { isTestIncidentsEnabled } from "@/lib/integrations/test-incident-config";
import {
  getTestDeskStatus,
  injectTestIncident,
  TEST_INCIDENT_KINDS,
  type TestIncidentKind,
} from "@/lib/integrations/test-incident";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseKind(body: unknown): TestIncidentKind | null {
  if (!body || typeof body !== "object") return null;
  const kind = (body as { kind?: string }).kind;
  return TEST_INCIDENT_KINDS.includes(kind as TestIncidentKind)
    ? (kind as TestIncidentKind)
    : null;
}

export async function GET(request: Request) {
  const auth = await authorizeTestIncidentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  const status = await getTestDeskStatus(prisma);
  return NextResponse.json({
    ...status,
    enabled: isTestIncidentsEnabled(),
    authVia: auth.via,
  });
}

export async function POST(request: Request) {
  const auth = await authorizeTestIncidentRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: auth.status });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const kind = parseKind(body) ?? "fatigue";
  const vehicleRegistration =
    body && typeof body === "object" && typeof (body as { vehicle_registration?: string }).vehicle_registration === "string"
      ? (body as { vehicle_registration: string }).vehicle_registration
      : undefined;

  const result = await injectTestIncident(prisma, { kind, vehicleRegistration });

  return NextResponse.json({
    ok: result.accepted,
    ...result,
    message: result.accepted
      ? result.duplicate
        ? "Duplicate drill event (already ingested)."
        : "Test incident injected — check Manager Live alerts and Command triage."
      : result.rejectReason ?? "Event rejected by catalogue filter.",
  });
}
