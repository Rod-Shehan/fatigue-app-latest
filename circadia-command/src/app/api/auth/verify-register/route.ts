import { verifyRegistrationResponse } from "@simplewebauthn/server";
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
    if (!pending || pending.flow !== "register") {
      throw new CommandApiError("ERR_SESSION_EXPIRED", "Registration challenge expired.", 403);
    }

    const operator = await prisma.commandOperator.findUnique({
      where: { operatorId: pending.operatorId },
    });
    if (!operator) {
      throw new CommandApiError("ERR_SCOPE_VIOLATION", "Operator not found.", 403);
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: pending.challenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new CommandApiError("ERR_MFA_CRYPTO_FAILURE", "Passkey verification failed.", 400);
    }

    const { credential, credentialDeviceType } = verification.registrationInfo;

    await prisma.$transaction([
      prisma.commandOperatorPasskey.upsert({
        where: { credentialId: credential.id },
        create: {
          credentialId: credential.id,
          operatorId: operator.operatorId,
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
          transports: credential.transports?.join(",") ?? credentialDeviceType,
        },
        update: {
          publicKey: Buffer.from(credential.publicKey),
          counter: BigInt(credential.counter),
        },
      }),
      prisma.commandOperator.update({
        where: { operatorId: operator.operatorId },
        data: { hardwareMfaVerified: true },
      }),
    ]);

    const token = await signSession({
      operatorId: operator.operatorId,
      name: operator.fullName,
      hardwareMfaVerified: true,
    });
    await setSessionCookie(token);
    await clearChallengeCookie();

    return Response.json({ ok: true, operator_id: operator.operatorId });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
