/** Shared drill incidents — Autonomise-shaped ingest for Manager + Command. */

export const TEST_INCIDENT_REGO_PREFIX = "TEST";
export const TEST_INCIDENT_EVENT_ID_PREFIX = "drill-";

export function isTestIncidentsEnabled(): boolean {
  const raw = process.env.TEST_INCIDENTS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function getTestIncidentInternalSecret(): string | null {
  const secret = process.env.TEST_INCIDENT_INTERNAL_SECRET?.trim();
  return secret || null;
}

export function getTestIncidentSampleClipUrl(eventId: string): string {
  const fromEnv = process.env.TEST_INCIDENT_SAMPLE_CLIP_URL?.trim();
  if (fromEnv) return fromEnv;
  return `pending://test-incident/${encodeURIComponent(eventId)}`;
}
