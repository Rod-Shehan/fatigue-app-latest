import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/** Step 1: identify operator by corporate email (OIDC can wrap this later). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Valid email is required.", 400);
    }

    let operator = await prisma.commandOperator.findUnique({ where: { email } });
    if (!operator) {
      const localPart = email.split("@")[0] ?? "Operator";
      operator = await prisma.commandOperator.create({
        data: {
          email,
          fullName: localPart.replace(/[._]/g, " "),
        },
      });
    }

    if (!operator.isActive) {
      throw new CommandApiError("ERR_SCOPE_VIOLATION", "Operator account is inactive.", 403);
    }

    const passkeyCount = await prisma.commandOperatorPasskey.count({
      where: { operatorId: operator.operatorId },
    });

    const step = passkeyCount === 0 || !operator.hardwareMfaVerified ? "register" : "login";

    return Response.json({
      operator_id: operator.operatorId,
      email: operator.email,
      full_name: operator.fullName,
      step,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
