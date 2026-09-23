import { requireOwnerId } from "@/lib/operator-context";
import { apiErrorResponse } from "@/lib/errors";
import { proxyTestIncidentRequest } from "@/lib/test-incident-client";

export async function POST(request: Request) {
  try {
    await requireOwnerId();
    return await proxyTestIncidentRequest(request, "/purge");
  } catch (error) {
    return apiErrorResponse(error);
  }
}
