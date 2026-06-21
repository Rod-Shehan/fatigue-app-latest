import { timingSafeEqual } from "crypto";

export const AUTONOMISE_WEBHOOK_SECRET_HEADER = "x-webhook-secret";

/** Read and verify Autonomise webhook shared secret (constant-time). */
export function verifyAutonomiseWebhookSecret(
  headerValue: string | null,
  expectedSecret: string | undefined
): boolean {
  if (!headerValue || !expectedSecret) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expectedSecret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getAutonomiseWebhookSecretFromEnv(): string | undefined {
  const v = process.env.AUTONOMISE_WEBHOOK_SECRET?.trim();
  return v || undefined;
}

export function getAutonomiseEventPresetFromEnv(): "core_only" | "core_plus_adas" | "custom" {
  const raw = (process.env.AUTONOMISE_EVENT_PRESET ?? "core_plus_adas").trim();
  if (raw === "core_only" || raw === "custom") return raw;
  return "core_plus_adas";
}

/** Autonomise webhook `eventTypes` numeric codes treated as DSM Fatigue for this tenant. */
export function getAutonomiseFatigueEventTypeCodesFromEnv(): number[] {
  const raw = (process.env.AUTONOMISE_FATIGUE_EVENT_TYPE_CODES ?? "2,18").trim();
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n));
}
