import { setSessionCookie, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { isDevAuthBypass } from "@/lib/auth/dev-mode";

/** Dev-only bypass when WebAuthn hardware is unavailable. */
export async function POST(request: Request) {
  if (!isDevAuthBypass() && process.env.COMMAND_ALLOW_DEV_LOGIN !== "true") {
    return Response.json({ error: "ERR_FORBIDDEN" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = (
    body.email?.trim().toLowerCase() ||
    process.env.COMMAND_DEV_OPERATOR_EMAIL ||
    "operator@circadia.local"
  );
  let operator = await prisma.commandOperator.findUnique({ where: { email } });
  if (!operator) {
    operator = await prisma.commandOperator.create({
      data: {
        email,
        fullName: "Dev Operator",
        hardwareMfaVerified: true,
      },
    });
  } else if (!operator.hardwareMfaVerified) {
    operator = await prisma.commandOperator.update({
      where: { operatorId: operator.operatorId },
      data: { hardwareMfaVerified: true },
    });
  }

  const token = await signSession({
    operatorId: operator.operatorId,
    name: operator.fullName,
    hardwareMfaVerified: true,
  });
  await setSessionCookie(token);

  return Response.json({ operator_id: operator.operatorId, email: operator.email });
}
