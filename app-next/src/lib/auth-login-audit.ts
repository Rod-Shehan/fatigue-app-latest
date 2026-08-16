/**
 * Structured login audit — safe for Vercel / server logs.
 * Never log passwords, tokens, session cookies, or bypass secrets.
 */

import { normalizeLoginEmail } from "@/lib/driver-login-gate";

export type LoginAuditOutcome =
  | "success"
  | "invalid_credentials"
  | "roster_rejected"
  | "alpha_restricted"
  | "client_paused"
  | "account_disabled"
  | "policy_blocked"
  | "rate_limited";

export type LoginAuditEvent = {
  event: "auth.login";
  ts: string;
  outcome: LoginAuditOutcome;
  email?: string;
  role?: string | null;
  ip?: string;
};

export function logLoginAttempt(args: Omit<LoginAuditEvent, "event" | "ts">): void {
  const payload: LoginAuditEvent = {
    event: "auth.login",
    ts: new Date().toISOString(),
    outcome: args.outcome,
  };
  if (args.email) {
    payload.email = normalizeLoginEmail(args.email);
  }
  if (args.role !== undefined) {
    payload.role = args.role;
  }
  if (args.ip && args.ip !== "unknown") {
    payload.ip = args.ip;
  }
  console.info(JSON.stringify(payload));
}
