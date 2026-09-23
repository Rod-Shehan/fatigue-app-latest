import { requireOwnerId } from "@/lib/operator-context";
import { apiErrorResponse } from "@/lib/errors";
import { proxyTestIncidentRequest } from "@/lib/test-incident-client";

export async function GET() {
  try {
    await requireOwnerId();
    return await proxyTestIncidentRequest(new Request("http://local"), "");
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireOwnerId();
    return await proxyTestIncidentRequest(request, "");
  } catch (error) {
    return apiErrorResponse(error);
  }
}
