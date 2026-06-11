import { describe, expect, it } from "vitest";
import {
  CAMERA_RISK_PACKET_VERSION,
  parseCameraRiskPacket,
  validateRiskBlockUploadBatch,
} from "@/lib/camera-risk-packet";
import { computeFusedRiskPercents } from "@/lib/risk-block-ingest";
import { cameraFatigueContribution } from "@/lib/manager-risk-timeline";

const samplePacket = {
  schema_version: CAMERA_RISK_PACKET_VERSION,
  packet_id: "pkt-1",
  device_id: "cam-001",
  block_start: "2026-06-02T06:00:00+08:00",
  block_minutes: 15,
  metrics: {
    drowsiness_score: 0.4,
    distraction_score: 0.2,
    eyes_off_road_seconds: 120,
    sample_coverage_pct: 90,
  },
};

describe("camera risk packet", () => {
  it("validates v1 packet", () => {
    const r = parseCameraRiskPacket(samplePacket);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.parsed.features.drowsinessScore).toBe(0.4);
      expect(r.parsed.blockStartMs).toBeGreaterThan(0);
    }
  });

  it("rejects wrong block_minutes", () => {
    const r = parseCameraRiskPacket({ ...samplePacket, block_minutes: 10 });
    expect(r.ok).toBe(false);
  });

  it("validates upload batch", () => {
    const r = validateRiskBlockUploadBatch({
      blocks: [
        {
          upload_id: "u1",
          block_start_ms: Date.parse("2026-06-02T06:00:00+08:00"),
          camera: samplePacket,
        },
      ],
    });
    expect(r.ok).toBe(true);
  });
});

describe("fused risk scoring", () => {
  it("camera increases live vs baseline", () => {
    const features = {
      drowsinessScore: 0.7,
      distractionScore: 0.5,
      eyesOffRoadSeconds: 200,
      sampleCoveragePct: 95,
      yawnCount: 2,
      headNodCount: 1,
    };
    expect(cameraFatigueContribution(features)).toBeGreaterThan(0.3);
    const { baselinePct, livePct, fusionSources } = computeFusedRiskPercents(
      Date.parse("2026-06-02T06:00:00+08:00"),
      features,
      { work_minutes: 10 }
    );
    expect(livePct).toBeGreaterThanOrEqual(baselinePct);
    expect(fusionSources).toContain("camera");
    expect(fusionSources).toContain("diary");
  });

  it("self-reported alertness raises fused scores", () => {
    const features = {
      drowsinessScore: 0.2,
      distractionScore: 0.1,
      eyesOffRoadSeconds: 10,
      sampleCoveragePct: 90,
      yawnCount: 0,
      headNodCount: 0,
    };
    const blockMs = Date.parse("2026-06-02T06:00:00+08:00");
    const low = computeFusedRiskPercents(blockMs, features, {
      work_minutes: 10,
      alertness_level: 1,
    });
    const high = computeFusedRiskPercents(blockMs, features, {
      work_minutes: 10,
      alertness_level: 5,
    });
    expect(high.livePct).toBeGreaterThan(low.livePct);
    expect(high.baselinePct).toBeGreaterThan(low.baselinePct);
  });
});
