/** True when local dev should skip WebAuthn (passkey) sign-in. */
export function isDevAuthBypass(): boolean {
  if (process.env.COMMAND_SKIP_WEBAUTHN === "false") return false;
  if (process.env.COMMAND_SKIP_WEBAUTHN === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export const DEV_AUTH_BYPASS_PUBLIC =
  process.env.NEXT_PUBLIC_COMMAND_SKIP_WEBAUTHN === "true" ||
  (process.env.NEXT_PUBLIC_COMMAND_SKIP_WEBAUTHN !== "false" &&
    process.env.NODE_ENV !== "production");
