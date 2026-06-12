import {
  generateRegistrationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { clearChallengeCookie, setChallengeCookie, signChallenge } from "@/lib/auth/session";
import { getRpId, operatorIdToUserHandle, RP_NAME } from "@/lib/auth/webauthn-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { operator_id?: string };
    if (!body.operator_id) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "operator_id is required.", 400);
    }

    const operator = await prisma.commandOperator.findUnique({
      where: { operatorId: body.operator_id },
      include: { passkeys: true },
    });
    if (!operator?.isActive) {
      throw new CommandApiError("ERR_SCOPE_VIOLATION", "Operator not found or inactive.", 403);
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: getRpId(),
      userName: operator.email,
      userDisplayName: operator.fullName,
      userID: operatorIdToUserHandle(operator.operatorId),
      attestationType: "none",
      authenticatorSelection: {
        authenticatorAttachment: "cross-platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      excludeCredentials: operator.passkeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports?.split(",") as AuthenticatorTransportFuture[] | undefined,
      })),
    });

    const challengeToken = await signChallenge({
      operatorId: operator.operatorId,
      challenge: options.challenge,
      flow: "register",
    });
    await clearChallengeCookie();
    await setChallengeCookie(challengeToken);

    return Response.json(options);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
