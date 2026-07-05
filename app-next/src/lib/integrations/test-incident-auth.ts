import { timingSafeEqual } from "crypto";
import { getManagerSession } from "@/lib/auth";
import {
  getTestIncidentInternalSecret,
  isTestIncidentsEnabled,
} from "@/lib/integrations/test-incident-config";

const TEST_INCIDENT_SECRET_HEADER = "x-test-incident-secret";

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type TestIncidentAuthResult =
  | { ok: true; via: "session" | "secret" }
  | { ok: false; status: number; message: string };

/** Manager/owner session (app-next UI) or shared secret (Command proxy). */
export async function authorizeTestIncidentRequest(
  request: Request
): Promise<TestIncidentAuthResult> {
  if (!isTestIncidentsEnabled()) {
    return {
      ok: false,
      status: 403,
      message: "Test incidents are disabled (set TEST_INCIDENTS_ENABLED=true).",
    };
  }

  const session = await getManagerSession();
  if (session) return { ok: true, via: "session" };

  const expected = getTestIncidentInternalSecret();
  const provided = request.headers.get(TEST_INCIDENT_SECRET_HEADER)?.trim() ?? "";
  if (expected && provided && secretsMatch(provided, expected)) {
    return { ok: true, via: "secret" };
  }

  return {
    ok: false,
    status: 401,
    message: "Manager sign-in or valid test-incident secret required.",
  };
}

export { TEST_INCIDENT_SECRET_HEADER };
