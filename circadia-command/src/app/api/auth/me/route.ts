import { getSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ authenticated: false }, { status: 401 });
    }
    return Response.json({
      authenticated: true,
      operator_id: session.sub,
      name: session.name,
      role: session.role,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
