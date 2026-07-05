const TEST_INCIDENT_SECRET_HEADER = "x-test-incident-secret";

export function appNextBaseUrl(): string {
  const raw = process.env.APP_NEXT_URL?.trim();
  return raw?.replace(/\/$/, "") || "https://www.circadia24.com";
}

export function testIncidentSecret(): string | null {
  const secret = process.env.TEST_INCIDENT_INTERNAL_SECRET?.trim();
  return secret || null;
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

  if (pathSuffix === "/purge" || request.method === "POST") {
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const body = request.method === "POST" ? await request.text() : undefined;
    return fetch(url, { method: "POST", headers, body: body || "{}" });
  }

  return fetch(url, { method: "GET", headers });
}
