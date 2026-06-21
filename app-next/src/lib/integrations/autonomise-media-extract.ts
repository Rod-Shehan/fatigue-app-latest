/**
 * Extract driver/road/video URLs from Autonomise API or webhook JSON.
 * Ported from autonomise-fleet-alerts autonomiseClient.js (behaviour-aligned).
 */

const VIDEO_EXT = /\.(mp4|webm|m3u8)(\?|$)/i;
const VIDEO_PATH = /\/video|\/clip|\/playback|\/recording/i;
const DRIVER_URL_HINTS = /driver|dsm|cab|face|inward|internal|operator/i;
const ROAD_URL_HINTS = /road|forward|adas|outward|external|front/i;

function asUrl(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (typeof value === "object" && value !== null && typeof (value as { url?: string }).url === "string") {
    return (value as { url: string }).url;
  }
  return "";
}

function firstUrl(...candidates: unknown[]): string {
  for (const c of candidates) {
    const u = asUrl(c);
    if (u) return u;
  }
  return "";
}

export function looksLikeVideoUrl(url: string): boolean {
  const u = String(url || "");
  return VIDEO_EXT.test(u) || VIDEO_PATH.test(u);
}

function rootOf(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") return {};
  const obj = data as Record<string, unknown>;
  const nested = obj.data ?? obj.result ?? obj.event;
  if (nested && typeof nested === "object") return nested as Record<string, unknown>;
  return obj;
}

export function scanVideoUrlsFromJson(data: unknown): { eventVideoUrl: string } {
  const urls: string[] = [];
  const seen = new Set<string>();

  function walk(node: unknown) {
    if (node == null) return;
    if (typeof node === "string") {
      if (/^https?:\/\//i.test(node) && !seen.has(node)) {
        seen.add(node);
        urls.push(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      for (const value of Object.values(node)) walk(value);
    }
  }

  walk(data);
  const eventVideoUrl = urls.find((u) => looksLikeVideoUrl(u)) ?? "";
  return { eventVideoUrl };
}

export function scanMediaUrlsFromJson(data: unknown): {
  driverCameraUrl: string;
  roadCameraUrl: string;
} {
  const urls: string[] = [];
  const seen = new Set<string>();

  function walk(node: unknown) {
    if (node == null) return;
    if (typeof node === "string") {
      if (/^https?:\/\//i.test(node) && !seen.has(node)) {
        seen.add(node);
        urls.push(node);
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      for (const value of Object.values(node)) walk(value);
    }
  }

  walk(data);

  let driverCameraUrl = "";
  let roadCameraUrl = "";
  for (const url of urls) {
    const lower = url.toLowerCase();
    if (!driverCameraUrl && DRIVER_URL_HINTS.test(lower)) driverCameraUrl = url;
    if (!roadCameraUrl && ROAD_URL_HINTS.test(lower)) roadCameraUrl = url;
  }
  if (!driverCameraUrl && urls.length >= 1) driverCameraUrl = urls[0];
  if (!roadCameraUrl && urls.length >= 2) roadCameraUrl = urls[1];

  return { driverCameraUrl, roadCameraUrl };
}

export function extractVideoFromJson(data: unknown): { eventVideoUrl: string } {
  const root = rootOf(data);
  let eventVideoUrl = firstUrl(
    root.eventVideoUrl,
    root.event_video_url,
    root.videoUrl,
    root.video_url,
    root.clipUrl,
    root.clip_url,
    root.playbackUrl,
    root.playback_url,
    root.recordingUrl,
    (root.media as Record<string, unknown> | undefined)?.video,
    (root.media as Record<string, unknown> | undefined)?.eventVideo,
    (root.media as Record<string, unknown> | undefined)?.clip,
    (root.media as Record<string, unknown> | undefined)?.playback
  );

  if (!eventVideoUrl && Array.isArray(root.media)) {
    for (const item of root.media) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const label = String(row.type ?? row.name ?? "").toLowerCase();
      const url = asUrl(row.url ?? row.href ?? row.link);
      if (!url) continue;
      if (/video|clip|recording|playback/.test(label) || looksLikeVideoUrl(url)) {
        eventVideoUrl = url;
        break;
      }
    }
  }

  if (!eventVideoUrl) {
    eventVideoUrl = scanVideoUrlsFromJson(data).eventVideoUrl;
  }

  return { eventVideoUrl: looksLikeVideoUrl(eventVideoUrl) ? eventVideoUrl : "" };
}

export type AutonomiseMediaUrls = {
  driverCameraUrl: string;
  roadCameraUrl: string;
  eventVideoUrl: string;
};

export function extractMediaFromJson(data: unknown): AutonomiseMediaUrls {
  const root = rootOf(data);

  const driver = firstUrl(
    root.driverCameraUrl,
    root.driver_camera_url,
    root.driverSnapshotUrl,
    root.driver_snapshot_url,
    (root.media as Record<string, unknown> | undefined)?.driverCameraUrl,
    (root.media as Record<string, unknown> | undefined)?.driver,
    (root.media as Record<string, unknown> | undefined)?.driverFace,
    (root.media as Record<string, unknown> | undefined)?.dsm,
    (root.snapshots as Record<string, unknown> | undefined)?.driver,
    (root.images as Record<string, unknown> | undefined)?.driver,
    root.driverImageUrl,
    root.driver_image_url
  );

  const road = firstUrl(
    root.roadCameraUrl,
    root.road_camera_url,
    root.forwardCameraUrl,
    root.forward_snapshot_url,
    root.roadSnapshotUrl,
    (root.media as Record<string, unknown> | undefined)?.roadCameraUrl,
    (root.media as Record<string, unknown> | undefined)?.road,
    (root.media as Record<string, unknown> | undefined)?.forward,
    (root.snapshots as Record<string, unknown> | undefined)?.road,
    (root.images as Record<string, unknown> | undefined)?.road,
    root.roadImageUrl,
    root.road_image_url
  );

  if ((!driver || !road) && Array.isArray(root.media)) {
    let fromListDriver = driver;
    let fromListRoad = road;
    for (const item of root.media) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const label = String(row.type ?? row.camera ?? row.name ?? "").toLowerCase();
      const url = asUrl(row.url ?? row.href ?? row.link);
      if (!url) continue;
      if (!fromListDriver && /driver|dsm|cab|face|inward/.test(label)) fromListDriver = url;
      if (!fromListRoad && /road|forward|adas|outward/.test(label)) fromListRoad = url;
    }
    const video = extractVideoFromJson(data);
    return {
      driverCameraUrl: fromListDriver,
      roadCameraUrl: fromListRoad,
      eventVideoUrl: video.eventVideoUrl,
    };
  }

  const video = extractVideoFromJson(data);
  return { driverCameraUrl: driver, roadCameraUrl: road, eventVideoUrl: video.eventVideoUrl };
}

export function extractDriverFromJson(data: unknown): { driverName: string; driverPhone: string } {
  const root = rootOf(data);
  const driver =
    root.driver && typeof root.driver === "object" ? (root.driver as Record<string, unknown>) : root;

  const driverName = String(
    driver.name ??
      driver.fullName ??
      driver.full_name ??
      driver.displayName ??
      driver.display_name ??
      root.driverName ??
      root.driver_name ??
      ""
  ).trim();

  const driverPhone = String(
    driver.phone ??
      driver.mobile ??
      driver.contactNumber ??
      driver.contact_number ??
      root.driverPhone ??
      root.driver_phone ??
      ""
  ).trim();

  return { driverName, driverPhone };
}

export function pickBestMediaUrl(urls: AutonomiseMediaUrls): string | null {
  const best = urls.eventVideoUrl || urls.driverCameraUrl || urls.roadCameraUrl;
  return best || null;
}
