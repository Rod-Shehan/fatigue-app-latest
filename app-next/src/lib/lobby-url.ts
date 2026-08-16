export type LobbyBranch = "driver" | "manager" | "owner";

/** Shared nav label for return to the sign-in landing page (`/`). */
export const LOBBY_NAV_LABEL = "Log-in Page";

/** Single landing page sign-in URL at `/`. */
export function lobbySignInUrl(opts: { branch?: LobbyBranch; callbackUrl?: string }): string {
  const params = new URLSearchParams();
  if (opts.branch) params.set("branch", opts.branch);
  if (opts.callbackUrl) params.set("callbackUrl", opts.callbackUrl);
  const q = params.toString();
  return q ? `/?${q}` : "/";
}

export function lobbyBranchFromCallback(callbackUrl: string | null): LobbyBranch {
  if (!callbackUrl) return "driver";
  if (callbackUrl.startsWith("/admin") || callbackUrl.startsWith("/circadia")) return "owner";
  if (callbackUrl.startsWith("/manager") || callbackUrl === "/drivers") return "manager";
  return "driver";
}
