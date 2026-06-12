import {
  generateAuthenticationOptions,
  type AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import { clearChallengeCookie, setChallengeCookie, signChallenge } from "@/lib/auth/session";
import { getRpId } from "@/lib/auth/webauthn-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { operator_id?: string };
    if (!body.operator_id) {
      throw new CommandApiError("ERR_MALFORMED_PAYLOAD", "operator_id is required.", 400);
    }

    const passkeys = await prisma.commandOperatorPasskey.findMany({
      where: { operatorId: body.operator_id },
    });
    if (passkeys.length === 0) {
      throw new CommandApiError("ERR_MFA_REQUIRED", "No passkey registered for this operator.", 403);
    }

    const options = await generateAuthenticationOptions({
      rpID: getRpId(),
      userVerification: "required",
      allowCredentials: passkeys.map((p) => ({
        id: p.credentialId,
        transports: p.transports?.split(",") as AuthenticatorTransportFuture[] | undefined,
      })),
    });

    const challengeToken = await signChallenge({
      operatorId: body.operator_id,
      challenge: options.challenge,
      flow: "login",
    });
    await clearChallengeCookie();
    await setChallengeCookie(challengeToken);

    return Response.json(options);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
