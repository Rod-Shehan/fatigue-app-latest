const TEST_INCIDENT_SECRET_HEADER = "x-test-incident-secret";

/** Manager/Enterprise app — Circadia hosts only, never *.vercel.app. */
export const ENTERPRISE_APP_URL = "https://enterprise.circadia24.com";

export function appNextBaseUrl(): string {
  const raw = process.env.APP_NEXT_URL?.trim();
  return raw?.replace(/\/$/, "") || ENTERPRISE_APP_URL;
}

export function testIncidentSecret(): string | null {
  const secret = process.env.TEST_INCIDENT_INTERNAL_SECRET?.trim();
  return secret || null;
}

/** Always return JSON to the Command UI — never a Vercel "The page could not be found" text body. */
export function jsonProxyResponse(upstream: Response, bodyText: string, upstreamUrl: string): Response {
  const trimmed = bodyText.trim();
  try {
    if (!trimmed) throw new Error("empty");
    JSON.parse(trimmed);
    return new Response(trimmed, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    const snippet = trimmed.slice(0, 160).replace(/\s+/g, " ");
    return Response.json(
      {
        message: `Enterprise at ${upstreamUrl} returned a non-JSON response (${upstream.status}). ${
          snippet || "Empty body."
        } APP_NEXT_URL must be a *.circadia24.com host that serves /api/* (use ${ENTERPRISE_APP_URL}).`,
      },
      { status: 502 }
    );
  }
}

export async function proxyTestIncidentRequest(
  request: Request,
  pathSuffix: "" | "/purge" = ""
): Promise<Response> {
  const secret = testIncidentSecret();
  if (!secret) {
    return Response.json(
      {
        message:
          "Test desk not configured on Command (set APP_NEXT_URL and TEST_INCIDENT_INTERNAL_SECRET).",
      },
      { status: 503 }
    );
  }

  const url = `${appNextBaseUrl()}/api/internal/test-incident${pathSuffix}`;
  const headers = new Headers({ [TEST_INCIDENT_SECRET_HEADER]: secret });

  let upstream: Response;
  if (pathSuffix === "/purge" || request.method === "POST") {
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const body = request.method === "POST" ? await request.text() : undefined;
    upstream = await fetch(url, { method: "POST", headers, body: body || "{}" });
  } else {
    upstream = await fetch(url, { method: "GET", headers });
  }

  const text = await upstream.text();
  return jsonProxyResponse(upstream, text, url);
}
