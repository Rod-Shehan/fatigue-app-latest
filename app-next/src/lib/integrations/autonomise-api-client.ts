/**
 * Autonomise REST client — fetch event media and driver details (server-side only).
 */

import {
  extractDriverFromJson,
  extractDeviceVehicleIdFromJson,
  extractMediaFromJson,
  extractVehicleFromJson,
  pickBestMediaUrl,
  type AutonomiseMediaUrls,
} from "@/lib/integrations/autonomise-media-extract";

const DOCUMENTED_DEVICE_MEDIA_PATH = "/device/{deviceId}/event/{eventId}/media";
const DEFAULT_OAUTH_TOKEN_URL = "https://login.autonomise.ai/connect/token";
const DEFAULT_OAUTH_SCOPE = "vt.api";

type OAuthTokenCacheEntry = { token: string; expiresAt: number };

const globalOAuth = globalThis as typeof globalThis & {
  __autonomiseOAuthCache?: Map<string, OAuthTokenCacheEntry>;
};

function oauthTokenCache(): Map<string, OAuthTokenCacheEntry> {
  if (!globalOAuth.__autonomiseOAuthCache) {
    globalOAuth.__autonomiseOAuthCache = new Map();
  }
  return globalOAuth.__autonomiseOAuthCache;
}

export function getAutonomiseOAuthTokenUrl(): string {
  return (process.env.AUTONOMISE_OAUTH_TOKEN_URL ?? DEFAULT_OAUTH_TOKEN_URL).trim();
}

export function getAutonomiseOAuthScope(): string {
  return (process.env.AUTONOMISE_OAUTH_SCOPE ?? DEFAULT_OAUTH_SCOPE).trim();
}

/** Third Party API (`api.autonomise.ai`) uses OAuth2 client credentials — Primary key is client_secret. */
export async function fetchAutonomiseOAuthAccessToken(
  config: AutonomiseApiConfig = getAutonomiseApiConfigFromEnv()
): Promise<string | null> {
  if (!config.clientId) return null;

  const cacheKey = config.clientId;
  const cached = oauthTokenCache().get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const secrets = [config.primaryKey, config.secondaryKey].filter(Boolean);
  for (const clientSecret of secrets) {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: clientSecret,
      scope: getAutonomiseOAuthScope(),
    });

    try {
      const res = await fetch(getAutonomiseOAuthTokenUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(12_000),
      });

      if (!res.ok) continue;

      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) continue;

      const expiresIn = Number(data.expires_in);
      const ttlMs = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn * 1000 : 3_600_000;
      oauthTokenCache().set(cacheKey, {
        token: data.access_token,
        expiresAt: Date.now() + ttlMs,
      });
      return data.access_token;
    } catch {
      /* try next secret */
    }
  }

  console.warn("[autonomise-api] OAuth client_credentials failed");
  return null;
}

async function parseAutonomiseJsonResponse(res: Response): Promise<unknown | null> {
  if (res.status === 204) return null;
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

const DEFAULT_MEDIA_TEMPLATES = [
  DOCUMENTED_DEVICE_MEDIA_PATH,
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
      process.env.AUTONOMISE_MEDIA_PATH_TEMPLATE ?? DOCUMENTED_DEVICE_MEDIA_PATH
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

function applyTemplate(
  template: string,
  eventId: string,
  clientId: string,
  deviceId = ""
): string {
  return template
    .replace("{eventId}", encodeURIComponent(eventId))
    .replace("{clientId}", encodeURIComponent(clientId))
    .replace("{deviceId}", encodeURIComponent(deviceId));
}

export function buildDeviceEventMediaPath(deviceHardwareId: string, eventId: string): string {
  return applyTemplate(DOCUMENTED_DEVICE_MEDIA_PATH, eventId, "", deviceHardwareId);
}

function apiBaseUrls(config: AutonomiseApiConfig): string[] {
  return [...new Set([config.baseUrl, config.appApiBaseUrl].filter(Boolean))];
}

function buildUrl(path: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function mediaPathCandidates(config: AutonomiseApiConfig, deviceHardwareId: string): string[] {
  const list = config.mediaPathTemplate
    ? [config.mediaPathTemplate, ...DEFAULT_MEDIA_TEMPLATES]
    : DEFAULT_MEDIA_TEMPLATES;
  return [...new Set(list)].filter((template) => {
    if (template.includes("{deviceId}") && !deviceHardwareId) return false;
    return true;
  });
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
  config: AutonomiseApiConfig,
  options: { apiOnly?: boolean } = {}
): Promise<unknown | null> {
  const tokens = [config.primaryKey, config.secondaryKey].filter(Boolean);
  const modes = ["api-key", "bearer", "x-custom", config.authMode].filter(
    (m, i, arr) => Boolean(m) && arr.indexOf(m) === i
  );

  const bases = options.apiOnly ? [config.baseUrl] : apiBaseUrls(config);
  let lastStatus = "";

  for (const base of bases) {
    if (base === config.baseUrl) {
      const oauthToken = await fetchAutonomiseOAuthAccessToken(config);
      if (oauthToken) {
        try {
          const res = await fetch(buildUrl(path, base), {
            method: "GET",
            headers: {
              Authorization: `Bearer ${oauthToken}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(12_000),
          });
          const data = await parseAutonomiseJsonResponse(res);
          if (data) return data;
          if (res.status === 204) return null;
          lastStatus = `HTTP ${res.status} @ ${base}${path} (oauth)`;
        } catch {
          /* fall through */
        }
      } else {
        lastStatus = `oauth_failed @ ${base}${path}`;
      }
      if (options.apiOnly) continue;
    }

    if (tokens.length === 0) continue;

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

          const data = await parseAutonomiseJsonResponse(res);
          if (data) return data;
          if (res.status === 204) return null;
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
  options: {
    fnolSlug?: string;
    deviceHardwareId?: string;
    config?: AutonomiseApiConfig;
  } = {}
): Promise<AutonomiseMediaUrls> {
  const config = options.config ?? getAutonomiseApiConfigFromEnv();
  const fnolSlug = options.fnolSlug ?? "";
  const deviceHardwareId = (options.deviceHardwareId ?? "").trim();

  if (!eventId || eventId.startsWith("TEST-EVT-")) {
    return { driverCameraUrl: "", roadCameraUrl: "", eventVideoUrl: "" };
  }

  if (!deviceHardwareId) {
    console.warn("[autonomise-api] media fetch skipped — no device hardware id on payload");
    return { driverCameraUrl: "", roadCameraUrl: "", eventVideoUrl: "" };
  }

  const deviceTemplate = config.mediaPathTemplate || DOCUMENTED_DEVICE_MEDIA_PATH;
  const path = applyTemplate(deviceTemplate, eventId, config.clientId, deviceHardwareId);
  const data = await autonomiseGet(path, config, { apiOnly: true });
  if (data) {
    const parsed = extractMediaFromJson(data);
    return {
      driverCameraUrl: parsed.driverCameraUrl,
      roadCameraUrl: parsed.roadCameraUrl,
      eventVideoUrl: parsed.eventVideoUrl,
    };
  }

  return { driverCameraUrl: "", roadCameraUrl: "", eventVideoUrl: "" };
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

export async function fetchAutonomiseVehicle(
  vehicleId: string,
  config: AutonomiseApiConfig = getAutonomiseApiConfigFromEnv()
): Promise<{ vehicleRego: string; driverId: string; makeModel: string }> {
  const id = String(vehicleId || "").trim();
  if (!id) return { vehicleRego: "", driverId: "", makeModel: "" };

  const data = await autonomiseGet(`/vehicle/${encodeURIComponent(id)}`, config, { apiOnly: true });
  if (!data) return { vehicleRego: "", driverId: "", makeModel: "" };
  return extractVehicleFromJson(data);
}

export async function fetchAutonomiseDriverById(
  driverId: string,
  config: AutonomiseApiConfig = getAutonomiseApiConfigFromEnv()
): Promise<{ driverName: string; driverPhone: string }> {
  const id = String(driverId || "").trim();
  if (!id) return { driverName: "", driverPhone: "" };

  const data = await autonomiseGet(`/driver/${encodeURIComponent(id)}`, config, { apiOnly: true });
  if (!data) return { driverName: "", driverPhone: "" };
  return extractDriverFromJson(data);
}

export async function fetchAutonomiseDeviceVehicleId(
  hardwareId: string,
  config: AutonomiseApiConfig = getAutonomiseApiConfigFromEnv()
): Promise<string> {
  const id = String(hardwareId || "").trim();
  if (!id) return "";

  const data = await autonomiseGet(`/device/${encodeURIComponent(id)}`, config, { apiOnly: true });
  if (!data) return "";
  return extractDeviceVehicleIdFromJson(data);
}

export type AutonomiseEventIdentity = {
  vehicleRego: string;
  driverName: string;
  deviceHardwareId: string;
};

/** Resolve VRN + driver from Autonomise vehicle/device APIs (MTS webhooks often send ids only). */
export async function fetchAutonomiseEventIdentity(args: {
  vendorVehicleId?: string | null;
  deviceHardwareId?: string | null;
  config?: AutonomiseApiConfig;
}): Promise<AutonomiseEventIdentity> {
  const config = args.config ?? getAutonomiseApiConfigFromEnv();
  if (!isAutonomiseApiConfigured(config)) {
    return { vehicleRego: "", driverName: "", deviceHardwareId: args.deviceHardwareId?.trim() ?? "" };
  }

  let vehicleId = String(args.vendorVehicleId ?? "").trim();
  const deviceHardwareId = String(args.deviceHardwareId ?? "").trim();

  if (!vehicleId && deviceHardwareId) {
    vehicleId = await fetchAutonomiseDeviceVehicleId(deviceHardwareId, config);
  }
  if (!vehicleId) {
    return { vehicleRego: "", driverName: "", deviceHardwareId };
  }

  const vehicle = await fetchAutonomiseVehicle(vehicleId, config);
  let driverName = "";
  if (vehicle.driverId) {
    const driver = await fetchAutonomiseDriverById(vehicle.driverId, config);
    driverName = driver.driverName;
  }

  return {
    vehicleRego: vehicle.vehicleRego,
    driverName,
    deviceHardwareId,
  };
}

export type AutonomiseMediaFetchResult = AutonomiseMediaUrls & {
  driverName: string;
  mediaUrl: string | null;
};

/** Fetch media + driver from Autonomise API for one event id. */
export async function fetchAutonomiseEventMediaBundle(
  eventId: string,
  options: {
    fnolSlug?: string;
    deviceHardwareId?: string;
    config?: AutonomiseApiConfig;
  } = {}
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
  const deviceHardwareId = options.deviceHardwareId ?? "";
  const [media, driver] = await Promise.all([
    fetchAutonomiseMediaUrls(eventId, { fnolSlug, deviceHardwareId, config }),
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
