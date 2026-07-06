/**
 * Fire-and-forget Web Push dispatch on Command when a lifecycle row is created.
 * Requires COMMAND_APP_URL + TEST_INCIDENT_INTERNAL_SECRET on app-next.
 */

export type CommandPushDispatchPayload = {
  lifecycleId: string;
  vehicleRegistration: string;
  fatigueMetricType: string;
  detectedAt: string;
};

export function notifyCommandIncidentPush(payload: CommandPushDispatchPayload): void {
  const base = process.env.COMMAND_APP_URL?.trim()?.replace(/\/$/, "");
  const secret = process.env.TEST_INCIDENT_INTERNAL_SECRET?.trim();
  if (!base || !secret) return;

  void fetch(`${base}/api/internal/dispatch-incident-push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-incident-secret": secret,
    },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
