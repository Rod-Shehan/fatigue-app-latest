/**
 * Driver-side queue for camera JSON packets received over Bluetooth.
 * Holds blocks during WA cellular blackspots; flushes to POST /api/driver/risk-blocks.
 */

import type { CameraRiskPacketV1, RiskBlockDiaryContext, RiskBlockUploadItem } from "@/lib/camera-risk-packet";
import { parseCameraRiskPacket } from "@/lib/camera-risk-packet";
import { alignToBlockStartMs } from "@/lib/manager-risk-timeline";

const STORAGE_KEY = "circadia-camera-risk-upload-queue";

export type QueuedCameraRiskUpload = {
  upload_id: string;
  block_start_ms: number;
  camera: CameraRiskPacketV1;
  diary?: RiskBlockDiaryContext;
  queued_at: string;
};

export type CameraBtIngestHandler = {
  /** Called when a valid JSON packet arrives from the camera over BT. */
  onPacket: (raw: unknown, diary?: RiskBlockDiaryContext) => QueuedCameraRiskUpload | null;
  /** Read pending uploads (sorted by block time). */
  listQueue: () => QueuedCameraRiskUpload[];
  /** Push to local queue (dedupe upload_id). */
  enqueue: (item: QueuedCameraRiskUpload) => void;
  /** Remove uploaded ids after successful server ack. */
  dequeueByUploadIds: (ids: string[]) => void;
  clear: () => void;
};

function readQueue(): QueuedCameraRiskUpload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedCameraRiskUpload[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createCameraRiskQueue(): CameraBtIngestHandler {
  return {
    onPacket(raw, diary) {
      const parsed = parseCameraRiskPacket(raw);
      if (!parsed.ok) {
        console.warn("[camera-risk] invalid packet:", parsed.error);
        return null;
      }
      const block_start_ms = alignToBlockStartMs(parsed.parsed.blockStartMs);
      const item: QueuedCameraRiskUpload = {
        upload_id: crypto.randomUUID(),
        block_start_ms,
        camera: parsed.parsed.packet,
        diary,
        queued_at: new Date().toISOString(),
      };
      this.enqueue(item);
      return item;
    },
    listQueue() {
      return readQueue().sort((a, b) => a.block_start_ms - b.block_start_ms);
    },
    enqueue(item) {
      const q = readQueue();
      if (q.some((x) => x.upload_id === item.upload_id)) return;
      q.push(item);
      writeQueue(q.sort((a, b) => a.block_start_ms - b.block_start_ms));
    },
    dequeueByUploadIds(ids) {
      const set = new Set(ids);
      writeQueue(readQueue().filter((x) => !set.has(x.upload_id)));
    },
    clear() {
      writeQueue([]);
    },
  };
}

/** Singleton for driver app — import this when wiring Web Bluetooth. */
let _queue: CameraBtIngestHandler | null = null;

export function getCameraRiskQueue(): CameraBtIngestHandler {
  if (!_queue) _queue = createCameraRiskQueue();
  return _queue;
}

export function queuedItemsToUploadBatch(items: QueuedCameraRiskUpload[]): RiskBlockUploadItem[] {
  return items.map((q) => ({
    upload_id: q.upload_id,
    block_start_ms: q.block_start_ms,
    camera: q.camera,
    diary: q.diary,
  }));
}

export type FlushRiskBlocksResult = {
  ok: boolean;
  accepted: number;
  skipped: number;
  error?: string;
};

/**
 * POST queued blocks to server; removes successfully accepted upload_ids from queue.
 * Call when online (and after blackspot restore for rapid back-fill).
 */
export async function flushCameraRiskQueue(
  postBatch: (body: { blocks: RiskBlockUploadItem[] }) => Promise<{
    ok: boolean;
    accepted: number;
    skipped: number;
    results?: { upload_id: string; created: boolean }[];
  }>
): Promise<FlushRiskBlocksResult> {
  const queue = getCameraRiskQueue();
  const pending = queue.listQueue();
  if (pending.length === 0) {
    return { ok: true, accepted: 0, skipped: 0 };
  }

  try {
    const res = await postBatch({ blocks: queuedItemsToUploadBatch(pending) });
    if (!res.ok) {
      return { ok: false, accepted: 0, skipped: 0, error: "Upload rejected" };
    }
    const processed = res.results?.map((r) => r.upload_id) ?? pending.map((p) => p.upload_id);
    queue.dequeueByUploadIds(processed);
    return { ok: true, accepted: res.accepted, skipped: res.skipped };
  } catch (e) {
    return {
      ok: false,
      accepted: 0,
      skipped: 0,
      error: e instanceof Error ? e.message : "Upload failed",
    };
  }
}

/**
 * Bluetooth bridge stub — replace internals when hardware SDK is chosen.
 * Keeps packet → queue → server path stable.
 */
export type CameraBtBridge = {
  connect: (deviceId?: string) => Promise<boolean>;
  disconnect: () => void;
  isConnected: () => boolean;
};

export function createCameraBtBridgeStub(): CameraBtBridge {
  return {
    async connect() {
      return false;
    },
    disconnect() {},
    isConnected: () => false,
  };
}
