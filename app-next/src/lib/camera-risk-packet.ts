/**
 * Camera → app JSON contract (Bluetooth ingest, 15-minute blocks).
 * Versioned so firmware can evolve without breaking the risk engine.
 *
 * @see docs/architecture/camera-risk-stream.md
 */

export const CAMERA_RISK_PACKET_VERSION = 1;
export const CAMERA_RISK_BLOCK_MINUTES = 15;

/** Normalised metrics for one 15-minute observation window. */
export type CameraRiskMetricsV1 = {
  /** Model output 0–1 (higher = more drowsy). */
  drowsiness_score?: number;
  /** Model output 0–1 (higher = more distracted). */
  distraction_score?: number;
  /** Seconds eyes off road / forward scene in block. */
  eyes_off_road_seconds?: number;
  yawn_count?: number;
  head_nod_count?: number;
  /** 0–100: fraction of block with usable video. */
  sample_coverage_pct?: number;
};

/** Packet emitted by cab camera edge device → driver app over BT. */
export type CameraRiskPacketV1 = {
  schema_version: typeof CAMERA_RISK_PACKET_VERSION;
  /** Unique id from device firmware (dedupe on device). */
  packet_id: string;
  device_id: string;
  /** Block start in Australia/Perth as ISO-8601 with offset, or UTC Z. */
  block_start: string;
  block_minutes: typeof CAMERA_RISK_BLOCK_MINUTES;
  metrics: CameraRiskMetricsV1;
  /** Optional vendor-specific fields (stored, not scored until mapped). */
  vendor?: Record<string, unknown>;
};

export type CameraBlockFeatures = {
  drowsinessScore: number;
  distractionScore: number;
  eyesOffRoadSeconds: number;
  sampleCoveragePct: number;
  yawnCount: number;
  headNodCount: number;
};

export type ParsedCameraBlock = {
  packet: CameraRiskPacketV1;
  blockStartMs: number;
  features: CameraBlockFeatures;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseBlockStartMs(blockStart: string): number | null {
  const ms = Date.parse(blockStart);
  return Number.isFinite(ms) ? ms : null;
}

export function validateCameraRiskPacket(raw: unknown): { ok: true; packet: CameraRiskPacketV1 } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Packet must be an object" };
  const p = raw as Record<string, unknown>;
  if (p.schema_version !== CAMERA_RISK_PACKET_VERSION) {
    return { ok: false, error: `Unsupported schema_version (expected ${CAMERA_RISK_PACKET_VERSION})` };
  }
  if (typeof p.packet_id !== "string" || !p.packet_id.trim()) {
    return { ok: false, error: "packet_id required" };
  }
  if (typeof p.device_id !== "string" || !p.device_id.trim()) {
    return { ok: false, error: "device_id required" };
  }
  if (typeof p.block_start !== "string" || !parseBlockStartMs(p.block_start)) {
    return { ok: false, error: "block_start must be a valid ISO timestamp" };
  }
  if (p.block_minutes !== CAMERA_RISK_BLOCK_MINUTES) {
    return { ok: false, error: `block_minutes must be ${CAMERA_RISK_BLOCK_MINUTES}` };
  }
  if (!p.metrics || typeof p.metrics !== "object") {
    return { ok: false, error: "metrics required" };
  }
  const m = p.metrics as Record<string, unknown>;
  const num = (k: string) => (m[k] === undefined ? undefined : Number(m[k]));
  const metrics: CameraRiskMetricsV1 = {
    drowsiness_score: num("drowsiness_score") !== undefined ? clamp01(num("drowsiness_score")!) : undefined,
    distraction_score: num("distraction_score") !== undefined ? clamp01(num("distraction_score")!) : undefined,
    eyes_off_road_seconds:
      num("eyes_off_road_seconds") !== undefined ? Math.max(0, num("eyes_off_road_seconds")!) : undefined,
    yawn_count: num("yawn_count") !== undefined ? Math.max(0, Math.floor(num("yawn_count")!)) : undefined,
    head_nod_count: num("head_nod_count") !== undefined ? Math.max(0, Math.floor(num("head_nod_count")!)) : undefined,
    sample_coverage_pct:
      num("sample_coverage_pct") !== undefined
        ? Math.min(100, Math.max(0, num("sample_coverage_pct")!))
        : undefined,
  };

  return {
    ok: true,
    packet: {
      schema_version: CAMERA_RISK_PACKET_VERSION,
      packet_id: p.packet_id.trim(),
      device_id: p.device_id.trim(),
      block_start: p.block_start,
      block_minutes: CAMERA_RISK_BLOCK_MINUTES,
      metrics,
      vendor: p.vendor && typeof p.vendor === "object" ? (p.vendor as Record<string, unknown>) : undefined,
    },
  };
}

export function extractCameraFeatures(packet: CameraRiskPacketV1): CameraBlockFeatures {
  const m = packet.metrics;
  return {
    drowsinessScore: clamp01(m.drowsiness_score ?? 0),
    distractionScore: clamp01(m.distraction_score ?? 0),
    eyesOffRoadSeconds: Math.max(0, m.eyes_off_road_seconds ?? 0),
    sampleCoveragePct: Math.min(100, Math.max(0, m.sample_coverage_pct ?? 0)),
    yawnCount: Math.max(0, Math.floor(m.yawn_count ?? 0)),
    headNodCount: Math.max(0, Math.floor(m.head_nod_count ?? 0)),
  };
}

export function parseCameraRiskPacket(raw: unknown): { ok: true; parsed: ParsedCameraBlock } | { ok: false; error: string } {
  const validated = validateCameraRiskPacket(raw);
  if (!validated.ok) return validated;
  const blockStartMs = parseBlockStartMs(validated.packet.block_start)!;
  return {
    ok: true,
    parsed: {
      packet: validated.packet,
      blockStartMs,
      features: extractCameraFeatures(validated.packet),
    },
  };
}

/** Diary context optionally co-uploaded with camera block (same 15-min window). */
export type RiskBlockDiaryContext = {
  work_minutes?: number;
  minutes_since_break?: number;
  rolling_work_hours_14d?: number;
  local_hour?: number;
  plan_deviation_minutes?: number;
  /** Driver self-report 1–5 from day setup (risk fusion only). */
  alertness_level?: 1 | 2 | 3 | 4 | 5;
};

export type RiskBlockUploadItem = {
  /** Client idempotency key (UUID). */
  upload_id: string;
  block_start_ms: number;
  camera: CameraRiskPacketV1;
  diary?: RiskBlockDiaryContext;
};

export type RiskBlockUploadBatch = {
  blocks: RiskBlockUploadItem[];
};

export function validateRiskBlockUploadBatch(raw: unknown): { ok: true; batch: RiskBlockUploadBatch } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Body must be an object" };
  const blocks = (raw as { blocks?: unknown }).blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { ok: false, error: "blocks array required" };
  }
  if (blocks.length > 96) {
    return { ok: false, error: "At most 96 blocks per request (~24h)" };
  }
  const parsed: RiskBlockUploadItem[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const row = blocks[i];
    if (!row || typeof row !== "object") return { ok: false, error: `blocks[${i}] invalid` };
    const r = row as Record<string, unknown>;
    if (typeof r.upload_id !== "string" || !r.upload_id.trim()) {
      return { ok: false, error: `blocks[${i}].upload_id required` };
    }
    const blockStartMs = Number(r.block_start_ms);
    if (!Number.isFinite(blockStartMs)) {
      return { ok: false, error: `blocks[${i}].block_start_ms must be a number` };
    }
    const cam = parseCameraRiskPacket(r.camera);
    if (!cam.ok) return { ok: false, error: `blocks[${i}].camera: ${cam.error}` };
    parsed.push({
      upload_id: r.upload_id.trim(),
      block_start_ms: blockStartMs,
      camera: cam.parsed.packet,
      diary: r.diary && typeof r.diary === "object" ? (r.diary as RiskBlockDiaryContext) : undefined,
    });
  }
  return { ok: true, batch: { blocks: parsed } };
}
