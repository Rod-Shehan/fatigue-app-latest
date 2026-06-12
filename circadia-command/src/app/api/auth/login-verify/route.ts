import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { CommandApiError, apiErrorResponse } from "@/lib/errors";
import {
  clearChallengeCookie,
  readChallengeCookie,
  setSessionCookie,
  signSession,
} from "@/lib/auth/session";
import { getOrigin, getRpId } from "@/lib/auth/webauthn-config";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pending = await readChallengeCookie();
    if (!pending || pending.flow !== "login") {
      throw new CommandApiError("ERR_SESSION_EXPIRED", "Login challenge expired.", 403);
    }

    const passkey = await prisma.commandOperatorPasskey.findUnique({
      where: { credentialId: body.id as string },
      include: { operator: true },
    });
    if (!passkey || passkey.operatorId !== pending.operatorId) {
      throw new CommandApiError("ERR_MFA_CRYPTO_FAILURE", "Unknown passkey credential.", 400);
    }
    if (!passkey.operator.isActive) {
      throw new CommandApiError("ERR_SCOPE_VIOLATION", "Operator account is inactive.", 403);
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: pending.challenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports?.split(",") as never,
      },
    });

    if (!verification.verified) {
      throw new CommandApiError("ERR_MFA_CRYPTO_FAILURE", "Passkey verification failed.", 400);
    }

    await prisma.commandOperatorPasskey.update({
      where: { credentialId: passkey.credentialId },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    const token = await signSession({
      operatorId: passkey.operator.operatorId,
      name: passkey.operator.fullName,
      hardwareMfaVerified: true,
    });
    await setSessionCookie(token);
    await clearChallengeCookie();

    return Response.json({ ok: true, operator_id: passkey.operator.operatorId });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
