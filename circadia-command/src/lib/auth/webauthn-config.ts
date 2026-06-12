export const RP_NAME = "Circadia Command Room";

export function getRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

export function getOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3001";
}

/** WebAuthn user handle — stable 16-byte ID from operator UUID. */
export function operatorIdToUserHandle(operatorId: string): Uint8Array<ArrayBuffer> {
  const hex = operatorId.replace(/-/g, "");
  const buffer = new ArrayBuffer(16);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
