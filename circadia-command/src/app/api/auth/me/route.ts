import { getSession } from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ authenticated: false }, { status: 401 });
    }

    const operator = await prisma.commandOperator.findUnique({
      where: { operatorId: session.sub },
      select: { username: true, role: true, isActive: true },
    });
    if (!operator?.isActive) {
      return Response.json({ authenticated: false }, { status: 401 });
    }

    return Response.json({
      authenticated: true,
      operator_id: session.sub,
      username: operator.username ?? session.username,
      name: session.name,
      role: operator.role,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
