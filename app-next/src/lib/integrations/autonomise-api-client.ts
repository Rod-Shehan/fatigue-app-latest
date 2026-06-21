/**
 * Autonomise REST client — fetch event media and driver details (server-side only).
 */

import {
  extractDriverFromJson,
  extractMediaFromJson,
  pickBestMediaUrl,
  type AutonomiseMediaUrls,
} from "@/lib/integrations/autonomise-media-extract";

const DEFAULT_MEDIA_TEMPLATES = [
  "/event/{eventId}/media?clientId={clientId}",
  "/events/{eventId}/media?clientId={clientId}",
  "/v1/events/{eventId}/media?clientId={clientId}",
  "/v1/event/{eventId}/media?clientId={clientId}",
  "/api/v1/events/{eventId}/media?clientId={clientId}",
  "/api/events/{eventId}/media?clientId={clientId}",
  "/v1/events/{eventId}/snapshots?clientId={clientId}",
  "/events/{eventId}/snapshots?clientId={clientId}",
  "/fnol/{eventId}/media?clientId={clientId}",
  "/media/event/{eventId}?clientId={clientId}",
];

const DEFAULT_EVENT_TEMPLATES = [
  "/v1/events/{eventId}?clientId={clientId}",
  "/events/{eventId}?clientId={clientId}",
  "/v1/event/{eventId}?clientId={clientId}",
];

export type AutonomiseApiConfig = {
  clientId: string;
  baseUrl: string;
  appApiBaseUrl: string;
  primaryKey: string;
  secondaryKey: string;
  authMode: string;
  mediaPathTemplate: string;
  eventPathTemplate: string;
};

export function getAutonomiseApiConfigFromEnv(): AutonomiseApiConfig {
  return {
    clientId: (process.env.AUTONOMISE_CLIENT_ID ?? "5e5A9Zq2e7").trim(),
    baseUrl: (process.env.AUTONOMISE_API_BASE_URL ?? "https://api.autonomise.ai").replace(/\/$/, ""),
    appApiBaseUrl: (process.env.AUTONOMISE_APP_API_BASE_URL ?? "https://app.autonomise.ai").replace(
      /\/$/,
      ""
    ),
    primaryKey: (process.env.AUTONOMISE_PRIMARY_KEY ?? "").trim(),
    secondaryKey: (process.env.AUTONOMISE_SECONDARY_KEY ?? "").trim(),
    authMode: (process.env.AUTONOMISE_AUTH_MODE ?? "api-key").toLowerCase(),
    mediaPathTemplate: (
      process.env.AUTONOMISE_MEDIA_PATH_TEMPLATE ?? "/event/{eventId}/media?clientId={clientId}"
    ).trim(),
    eventPathTemplate: (process.env.AUTONOMISE_EVENT_PATH_TEMPLATE ?? "").trim(),
  };
}

export function isAutonomiseApiConfigured(config: AutonomiseApiConfig = getAutonomiseApiConfigFromEnv()): boolean {
  return Boolean(config.primaryKey || config.secondaryKey);
}

function authHeaders(token: string, mode: string): Record<string, string> {
  if (mode === "api-key") return { "X-API-Key": token };
  if (mode === "x-custom") return { "X-Autonomise-Token": token };
  return { Authorization: `Bearer ${token}` };
}

function applyTemplate(template: string, eventId: string, clientId: string): string {
  return template
    .replace("{eventId}", encodeURIComponent(eventId))
    .replace("{clientId}", encodeURIComponent(clientId));
}

function apiBaseUrls(config: AutonomiseApiConfig): string[] {
  return [...new Set([config.baseUrl, config.appApiBaseUrl].filter(Boolean))];
}

function buildUrl(path: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function mediaPathCandidates(config: AutonomiseApiConfig): string[] {
  const list = config.mediaPathTemplate
    ? [config.mediaPathTemplate, ...DEFAULT_MEDIA_TEMPLATES]
    : DEFAULT_MEDIA_TEMPLATES;
  return [...new Set(list)];
}

function eventPathCandidates(config: AutonomiseApiConfig): string[] {
  const list = config.eventPathTemplate
    ? [config.eventPathTemplate, ...DEFAULT_EVENT_TEMPLATES]
    : DEFAULT_EVENT_TEMPLATES;
  return [...new Set(list)];
}

function mediaLookupIds(eventId: string, fnolSlug: string): string[] {
  const ids: string[] = [];
  for (const id of [eventId, fnolSlug]) {
    const t = String(id || "").trim();
    if (t && !ids.includes(t)) ids.push(t);
  }
  return ids;
}

async function autonomiseGet(
  path: string,
  config: AutonomiseApiConfig
): Promise<unknown | null> {
  const tokens = [config.primaryKey, config.secondaryKey].filter(Boolean);
  if (tokens.length === 0) return null;

  const modes = ["api-key", "bearer", "x-custom", config.authMode].filter(
    (m, i, arr) => Boolean(m) && arr.indexOf(m) === i
  );

  let lastStatus = "";
  for (const base of apiBaseUrls(config)) {
    for (const token of tokens) {
      for (const mode of modes) {
        try {
          const res = await fetch(buildUrl(path, base), {
            method: "GET",
            headers: {
              ...authHeaders(token, mode),
              Accept: "application/json",
              "X-Client-Id": config.clientId,
            },
            signal: AbortSignal.timeout(12_000),
          });

          if (res.ok) {
            return await res.json();
          }
          lastStatus = `HTTP ${res.status} @ ${base}${path}`;
        } catch {
          /* try next auth mode */
        }
      }
    }
  }

  if (lastStatus) {
    console.warn("[autonomise-api] GET failed", path, lastStatus);
  }
  return null;
}

export async function fetchAutonomiseMediaUrls(
  eventId: string,
  options: { fnolSlug?: string; config?: AutonomiseApiConfig } = {}
): Promise<AutonomiseMediaUrls> {
  const config = options.config ?? getAutonomiseApiConfigFromEnv();
  const fnolSlug = options.fnolSlug ?? "";

  if (!eventId || eventId.startsWith("TEST-EVT-")) {
    return { driverCameraUrl: "", roadCameraUrl: "", eventVideoUrl: "" };
  }

  let driverCameraUrl = "";
  let roadCameraUrl = "";
  let eventVideoUrl = "";

  for (const lookupId of mediaLookupIds(eventId, fnolSlug)) {
    for (const template of mediaPathCandidates(config)) {
      const data = await autonomiseGet(applyTemplate(template, lookupId, config.clientId), config);
      if (!data) continue;
      const parsed = extractMediaFromJson(data);
      driverCameraUrl = driverCameraUrl || parsed.driverCameraUrl;
      roadCameraUrl = roadCameraUrl || parsed.roadCameraUrl;
      eventVideoUrl = eventVideoUrl || parsed.eventVideoUrl;
      if (driverCameraUrl && roadCameraUrl && eventVideoUrl) break;
    }
    if (driverCameraUrl || roadCameraUrl || eventVideoUrl) break;
  }

  return { driverCameraUrl, roadCameraUrl, eventVideoUrl };
}

export async function fetchAutonomiseEventDriver(
  eventId: string,
  config: AutonomiseApiConfig = getAutonomiseApiConfigFromEnv()
): Promise<{ driverName: string; driverPhone: string }> {
  if (!eventId || eventId.startsWith("TEST-EVT-")) {
    return { driverName: "", driverPhone: "" };
  }

  for (const template of eventPathCandidates(config)) {
    const data = await autonomiseGet(applyTemplate(template, eventId, config.clientId), config);
    if (!data) continue;
    const parsed = extractDriverFromJson(data);
    if (parsed.driverName || parsed.driverPhone) return parsed;
  }

  return { driverName: "", driverPhone: "" };
}

export type AutonomiseMediaFetchResult = AutonomiseMediaUrls & {
  driverName: string;
  mediaUrl: string | null;
};

/** Fetch media + driver from Autonomise API for one event id. */
export async function fetchAutonomiseEventMediaBundle(
  eventId: string,
  options: { fnolSlug?: string; config?: AutonomiseApiConfig } = {}
): Promise<AutonomiseMediaFetchResult> {
  const config = options.config ?? getAutonomiseApiConfigFromEnv();
  if (!isAutonomiseApiConfigured(config)) {
    return {
      driverCameraUrl: "",
      roadCameraUrl: "",
      eventVideoUrl: "",
      driverName: "",
      mediaUrl: null,
    };
  }

  const fnolSlug = options.fnolSlug ?? "";
  const [media, driver] = await Promise.all([
    fetchAutonomiseMediaUrls(eventId, { fnolSlug, config }),
    fetchAutonomiseEventDriver(eventId, config),
  ]);

  let driverName = driver.driverName;
  if (!driverName && fnolSlug) {
    const viaSlug = await fetchAutonomiseEventDriver(fnolSlug, config);
    if (viaSlug.driverName) driverName = viaSlug.driverName;
  }

  return {
    ...media,
    driverName,
    mediaUrl: pickBestMediaUrl(media),
  };
}
