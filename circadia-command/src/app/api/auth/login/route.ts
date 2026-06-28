import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { parsePasswordInput, verifyOperatorPassword } from "@/lib/auth/password";
import { parseUsernameInput } from "@/lib/auth/username";
import { isCommandRole } from "@/lib/auth/roles";
import { setSessionCookie, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Username + password sign-in. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      password?: string;
    };

    const loginId =
      body.username?.trim().toLowerCase() || body.email?.trim().toLowerCase() || "";
    if (!loginId) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "Username is required.", 400);
    }

    const passwordParsed = parsePasswordInput(body.password);
    if (!passwordParsed.ok) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", passwordParsed.error, 400);
    }

    const operator = await prisma.commandOperator.findFirst({
      where: {
        OR: [{ username: loginId }, { email: loginId }],
      },
    });

    const valid =
      operator?.isActive &&
      operator.passwordHash &&
      (await verifyOperatorPassword(passwordParsed.value, operator.passwordHash));

    if (!valid) {
      throw new CommandApiError(
        "ERR_INVALID_CREDENTIALS",
        "Invalid username or password.",
        401
      );
    }

    const role = isCommandRole(operator!.role) ? operator!.role : "command_operator";

    const token = await signSession({
      operatorId: operator!.operatorId,
      name: operator!.fullName,
      username: operator!.username,
      role,
    });
    await setSessionCookie(token);

    return Response.json({
      operator_id: operator!.operatorId,
      username: operator!.username,
      full_name: operator!.fullName,
      role,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
