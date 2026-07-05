import { requireOwnerId } from "@/lib/operator-context";
import { apiErrorResponse } from "@/lib/errors";
import { proxyTestIncidentRequest } from "@/lib/test-incident-client";

export async function GET() {
  try {
    await requireOwnerId();
    const res = await proxyTestIncidentRequest(new Request("http://local"), "");
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwnerId();
    const res = await proxyTestIncidentRequest(request, "");
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
