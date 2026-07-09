import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertEngineThresholds,
  validateCameraRiskPacketV2,
  validateEdgeSessionInitV1,
  validateEvidenceCapsuleV1,
  validateVaultAckV1,
} from "@/lib/circadia-contracts/validate";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const FIXTURES = path.join(REPO_ROOT, "docs/architecture/schemas/fixtures");

function loadFixture(name: string): unknown {
  const raw = fs.readFileSync(path.join(FIXTURES, name), "utf8");
  return JSON.parse(raw) as unknown;
}

describe("circadia-contracts golden fixtures", () => {
  it("validates camera-block-v2-normal.json", () => {
    const r = validateCameraRiskPacketV2(loadFixture("camera-block-v2-normal.json"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(assertEngineThresholds(r.value)).toEqual([]);
  });

  it("validates camera-block-v2-drift-anomaly.json with consistent flags", () => {
    const r = validateCameraRiskPacketV2(loadFixture("camera-block-v2-drift-anomaly.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.operational_flags.unintended_drift_anomaly).toBe(true);
      expect(assertEngineThresholds(r.value)).toEqual([]);
    }
  });

  it("validates camera-block-v2-suspect-pre-fatigue.json", () => {
    const r = validateCameraRiskPacketV2(loadFixture("camera-block-v2-suspect-pre-fatigue.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.operational_flags.suspect_pre_fatigue).toBe(true);
      expect(assertEngineThresholds(r.value)).toEqual([]);
    }
  });

  it("validates camera-block-v2-cognitive-tunneling.json", () => {
    const r = validateCameraRiskPacketV2(loadFixture("camera-block-v2-cognitive-tunneling.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.operational_flags.cognitive_tunneling).toBe(true);
      expect(r.value.metrics.fixation_duration_max_seconds).toBeGreaterThan(3.5);
      expect(assertEngineThresholds(r.value)).toEqual([]);
    }
  });

  it("validates edge-session-init-v1-acknowledged.json", () => {
    const r = validateEdgeSessionInitV1(loadFixture("edge-session-init-v1-acknowledged.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.fit_for_work_acknowledged).toBe(true);
      expect(r.value.enrollment_audit?.frames_analyzed).toBe(30000);
    }
  });

  it("validates evidence-capsule-v1-drift-anomaly.json", () => {
    const r = validateEvidenceCapsuleV1(loadFixture("evidence-capsule-v1-drift-anomaly.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.trigger_type).toBe("drift_anomaly");
      expect(r.value.narrative?.manager_summary).toContain("steering");
    }
  });

  it("validates evidence-capsule-v1-silent-observation.json", () => {
    const r = validateEvidenceCapsuleV1(loadFixture("evidence-capsule-v1-silent-observation.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.operational_flags.silent_observation_mode).toBe(true);
      expect(r.value.operational_flags.promote_to_command).toBe(false);
    }
  });

  it("validates vault-ack-v1-success.json", () => {
    const r = validateVaultAckV1(loadFixture("vault-ack-v1-success.json"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe("stored");
  });
});
