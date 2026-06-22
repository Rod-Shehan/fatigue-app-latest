/**
 * Extract driver/road/video URLs from Autonomise API or webhook JSON.
 * Ported from autonomise-fleet-alerts autonomiseClient.js (behaviour-aligned).
 */

const VIDEO_EXT = /\.(mp4|webm|m3u8)(\?|$)/i;
const VIDEO_PATH = /\/video|\/clip|\/playback|\/recording/i;
const DRIVER_CHANNEL_HINTS = /driver|dsm|cab|face|inward|internal|operator/i;
const ROAD_CHANNEL_HINTS = /external|forward|road|adas|outward|front/i;
const DRIVER_URL_HINTS = DRIVER_CHANNEL_HINTS;
const ROAD_URL_HINTS = ROAD_CHANNEL_HINTS;

function asUrl(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  if (typeof value === "object" && value !== null) {
    const row = value as { url?: string; uri?: string };
    if (typeof row.url === "string" && /^https?:\/\//i.test(row.url)) return row.url;
    if (typeof row.uri === "string" && /^https?:\/\//i.test(row.uri)) return row.uri;
  }
  return "";
}

function isVideoMime(mime: string): boolean {
  return /^video\//i.test(mime);
}

function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
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

/** Autonomise `media[]` channel — Internal/DSM vs External/forward (VT3600). */
export function classifyAutonomiseMediaChannel(row: Record<string, unknown>): "driver" | "road" | "unknown" {
  const label = String(row.channelLabel ?? row.channel_label ?? row.type ?? row.name ?? "").toLowerCase();
  if (label) {
    if (DRIVER_CHANNEL_HINTS.test(label)) return "driver";
    if (ROAD_CHANNEL_HINTS.test(label)) return "road";
  }

  const channel = row.channel;
  if (channel === 1 || channel === "1") return "driver";
  if (channel === 0 || channel === "0") return "road";

  return "unknown";
}

type ParsedMediaList = {
  driverVideoUrl: string;
  roadVideoUrl: string;
  driverImageUrl: string;
  roadImageUrl: string;
};

/** Parse Autonomise `GET …/media` list — prefer Internal/driver channel for DSM fatigue. */
export function parseAutonomiseMediaList(media: unknown[]): ParsedMediaList {
  const result: ParsedMediaList = {
    driverVideoUrl: "",
    roadVideoUrl: "",
    driverImageUrl: "",
    roadImageUrl: "",
  };
  const unknownVideos: string[] = [];

  for (const item of media) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = asUrl(row.uri ?? row.url ?? row.href ?? row.link);
    if (!url) continue;

    const mime = String(row.mimeType ?? row.mime_type ?? "");
    const isVideo = isVideoMime(mime) || looksLikeVideoUrl(url);
    const channel = classifyAutonomiseMediaChannel(row);

    if (isVideo) {
      if (channel === "driver" && !result.driverVideoUrl) result.driverVideoUrl = url;
      else if (channel === "road" && !result.roadVideoUrl) result.roadVideoUrl = url;
      else if (channel === "unknown") unknownVideos.push(url);
      continue;
    }

    if (isImageMime(mime) || !isVideo) {
      if (channel === "driver" && !result.driverImageUrl) result.driverImageUrl = url;
      else if (channel === "road" && !result.roadImageUrl) result.roadImageUrl = url;
    }
  }

  if (!result.driverVideoUrl && unknownVideos.length === 1) {
    result.driverVideoUrl = unknownVideos[0];
  } else if (!result.driverVideoUrl && unknownVideos.length >= 2) {
    result.roadVideoUrl = result.roadVideoUrl || unknownVideos[0];
    result.driverVideoUrl = unknownVideos[1];
  }

  return result;
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

  if (Array.isArray(root.media)) {
    const parsed = parseAutonomiseMediaList(root.media);
    const eventVideoUrl = parsed.driverVideoUrl || parsed.roadVideoUrl;
    return { eventVideoUrl: looksLikeVideoUrl(eventVideoUrl) ? eventVideoUrl : "" };
  }

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
      const label = String(row.type ?? row.name ?? row.channelLabel ?? "").toLowerCase();
      const mime = String(row.mimeType ?? row.mime_type ?? "");
      const url = asUrl(row.uri ?? row.url ?? row.href ?? row.link);
      if (!url) continue;
      if (
        isVideoMime(mime) ||
        /video|clip|recording|playback/.test(label) ||
        looksLikeVideoUrl(url)
      ) {
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

  if (Array.isArray(root.media)) {
    const parsed = parseAutonomiseMediaList(root.media);
    return {
      driverCameraUrl: parsed.driverVideoUrl || parsed.driverImageUrl,
      roadCameraUrl: parsed.roadVideoUrl || parsed.roadImageUrl,
      eventVideoUrl: parsed.driverVideoUrl || parsed.roadVideoUrl,
    };
  }

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
      const label = String(row.type ?? row.camera ?? row.name ?? row.channelLabel ?? "").toLowerCase();
      const mime = String(row.mimeType ?? row.mime_type ?? "");
      const url = asUrl(row.uri ?? row.url ?? row.href ?? row.link);
      if (!url) continue;
      const isVideo = isVideoMime(mime) || looksLikeVideoUrl(url);
      if (!fromListDriver && !isVideo && (isImageMime(mime) || /driver|dsm|cab|face|inward/.test(label))) {
        fromListDriver = url;
      }
      if (!fromListRoad && !isVideo && (isImageMime(mime) || /road|forward|adas|outward/.test(label))) {
        fromListRoad = url;
      }
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
  if (urls.driverCameraUrl && looksLikeVideoUrl(urls.driverCameraUrl)) return urls.driverCameraUrl;
  if (urls.eventVideoUrl) return urls.eventVideoUrl;
  if (urls.driverCameraUrl) return urls.driverCameraUrl;
  if (urls.roadCameraUrl && looksLikeVideoUrl(urls.roadCameraUrl)) return urls.roadCameraUrl;
  return urls.roadCameraUrl || null;
}
