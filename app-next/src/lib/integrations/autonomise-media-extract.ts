/**
 * Extract driver/road/video URLs from Autonomise API or webhook JSON.
 * Ported from autonomise-fleet-alerts autonomiseClient.js (behaviour-aligned).
 */

const VIDEO_EXT = /\.(mp4|webm|m3u8)(\?|$)/i;
const VIDEO_PATH = /\/video|\/clip|\/playback|\/recording/i;
/** VT3600-AI (MTS): ch0 Forward, ch1 Internal (centre), ch2 Driver, ch3 Load */
const VT3600_DRIVER_CHANNEL = 2;
const VT3600_FORWARD_CHANNEL = 0;
const VT3600_INTERNAL_CHANNEL = 1;
const VT3600_LOAD_CHANNEL = 3;
const DRIVER_CHANNEL_LABEL_HINTS = /\bdriver\b|dsm|face|inward|operator/i;
const INTERNAL_CHANNEL_LABEL_HINTS = /\binternal\b|centre|center/i;
const ROAD_CHANNEL_HINTS = /external|forward|road|adas|outward|front/i;
const LOAD_CHANNEL_LABEL_HINTS = /\bload\b/i;
const DRIVER_URL_HINTS = /driver|dsm|cab|face|inward|operator/i;
const ROAD_URL_HINTS = ROAD_CHANNEL_HINTS;
/** Autonomise MediaType: 3 Video, 6 AiVideo — prefer over 7 BirdsEye / 8 Combined for DSM fatigue */
const PREFERRED_FATIGUE_MEDIA_TYPES = new Set([3, 6]);
const DEPRIORITIZED_FATIGUE_MEDIA_TYPES = new Set([7, 8]);

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

export type AutonomiseMediaChannel = "driver" | "road" | "internal" | "load" | "unknown";

function parseChannelNumber(channel: unknown): number | null {
  if (typeof channel === "number" && Number.isFinite(channel)) return channel;
  if (typeof channel === "string" && channel.trim() !== "") {
    const n = Number.parseInt(channel, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseMediaType(row: Record<string, unknown>): number | null {
  const raw = row.mediaType ?? row.media_type;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function fatigueVideoRank(mediaType: number | null): number {
  if (mediaType == null) return 1;
  if (PREFERRED_FATIGUE_MEDIA_TYPES.has(mediaType)) return 3;
  if (DEPRIORITIZED_FATIGUE_MEDIA_TYPES.has(mediaType)) return 0;
  return 2;
}

/** VT3600-AI channel labels + Autonomise `media[]` metadata. */
export function classifyAutonomiseMediaChannel(row: Record<string, unknown>): AutonomiseMediaChannel {
  const label = String(row.channelLabel ?? row.channel_label ?? row.type ?? row.name ?? "")
    .trim()
    .toLowerCase();
  const channelNum = parseChannelNumber(row.channel);

  if (label) {
    if (DRIVER_CHANNEL_LABEL_HINTS.test(label)) return "driver";
    if (LOAD_CHANNEL_LABEL_HINTS.test(label)) return "load";
    if (INTERNAL_CHANNEL_LABEL_HINTS.test(label)) return "internal";
    if (ROAD_CHANNEL_HINTS.test(label)) return "road";
  }

  if (channelNum === VT3600_DRIVER_CHANNEL) return "driver";
  if (channelNum === VT3600_FORWARD_CHANNEL) return "road";
  if (channelNum === VT3600_INTERNAL_CHANNEL) return "internal";
  if (channelNum === VT3600_LOAD_CHANNEL) return "load";

  return "unknown";
}

function pickBetterFatigueVideo(current: string, currentType: number | null, next: string, nextType: number | null): {
  url: string;
  mediaType: number | null;
} {
  if (!current) return { url: next, mediaType: nextType };
  if (fatigueVideoRank(nextType) > fatigueVideoRank(currentType)) {
    return { url: next, mediaType: nextType };
  }
  return { url: current, mediaType: currentType };
}

type ParsedMediaList = {
  driverVideoUrl: string;
  roadVideoUrl: string;
  driverImageUrl: string;
  roadImageUrl: string;
};

/** Parse Autonomise `GET …/media` list — VT3600 ch2 Driver for DSM fatigue. */
export function parseAutonomiseMediaList(media: unknown[]): ParsedMediaList {
  const result: ParsedMediaList = {
    driverVideoUrl: "",
    roadVideoUrl: "",
    driverImageUrl: "",
    roadImageUrl: "",
  };
  let driverVideoType: number | null = null;

  for (const item of media) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = asUrl(row.uri ?? row.url ?? row.href ?? row.link);
    if (!url) continue;

    const mime = String(row.mimeType ?? row.mime_type ?? "");
    const isVideo = isVideoMime(mime) || looksLikeVideoUrl(url);
    const channel = classifyAutonomiseMediaChannel(row);
    const mediaType = parseMediaType(row);

    if (isVideo) {
      if (channel === "driver") {
        const picked = pickBetterFatigueVideo(
          result.driverVideoUrl,
          driverVideoType,
          url,
          mediaType
        );
        result.driverVideoUrl = picked.url;
        driverVideoType = picked.mediaType;
      } else if (channel === "road" && !result.roadVideoUrl) {
        result.roadVideoUrl = url;
      }
      continue;
    }

    if (isImageMime(mime) || !isVideo) {
      if (channel === "driver" && !result.driverImageUrl) result.driverImageUrl = url;
      else if (channel === "road" && !result.roadImageUrl) result.roadImageUrl = url;
    }
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
