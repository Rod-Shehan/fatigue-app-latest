import { getSession } from "@/lib/auth/session";
import { CommandApiError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function requireOperatorId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new CommandApiError(
      "ERR_TOKEN_EXPIRED",
      "No operator session. Sign in with your hardware passkey.",
      401
    );
  }

  const operator = await prisma.commandOperator.findUnique({
    where: { operatorId: session.sub },
    select: { isActive: true, hardwareMfaVerified: true },
  });

  if (!operator?.isActive) {
    throw new CommandApiError("ERR_SCOPE_VIOLATION", "Operator account is inactive.", 403);
  }
  if (!operator.hardwareMfaVerified) {
    throw new CommandApiError(
      "ERR_MFA_REQUIRED",
      "Hardware MFA enrollment required before console access.",
      403
    );
  }

  return session.sub;
}

export async function requireOperatorSession() {
  const operatorId = await requireOperatorId();
  const session = await getSession();
  return { operatorId, session: session! };
}
