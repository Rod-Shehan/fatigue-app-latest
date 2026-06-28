/**
 * Autonomise webhook ingest → Circadia Command lifecycle queue (shared Neon).
 * Uses the same accepted-event gate as manager Live alerts.
 */

export function isCommandLifecycleBridgeEnabled(): boolean {
  const raw = process.env.COMMAND_LIFECYCLE_BRIDGE_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") return false;
  if (raw === "true" || raw === "1" || raw === "yes") return true;
  return Boolean(commandPilotTenantIdUuid());
}

export function commandPilotTenantIdUuid(): string | null {
  const id = process.env.COMMAND_PILOT_TENANT_ID_UUID?.trim();
  return id || null;
}
