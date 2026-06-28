import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import {
  hashOperatorPassword,
  parsePasswordInput,
  verifyOperatorPassword,
} from "@/lib/auth/password";
import { requireOperatorId } from "@/lib/operator-context";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const operatorId = await requireOperatorId();
    const body = (await request.json()) as { current_password?: string; new_password?: string };

    const currentParsed = parsePasswordInput(body.current_password);
    if (!currentParsed.ok) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", currentParsed.error, 400);
    }
    const newParsed = parsePasswordInput(body.new_password);
    if (!newParsed.ok) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", newParsed.error, 400);
    }

    const operator = await prisma.commandOperator.findUnique({
      where: { operatorId },
      select: { passwordHash: true },
    });
    if (!operator?.passwordHash) {
      throw new CommandApiError("ERR_FORBIDDEN", "Password is not configured for this account.", 403);
    }

    const currentOk = await verifyOperatorPassword(currentParsed.value, operator.passwordHash);
    if (!currentOk) {
      throw new CommandApiError("ERR_INVALID_CREDENTIALS", "Current password is incorrect.", 401);
    }

    await prisma.commandOperator.update({
      where: { operatorId },
      data: {
        passwordHash: await hashOperatorPassword(newParsed.value),
        passwordSetAt: new Date(),
      },
    });

    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
