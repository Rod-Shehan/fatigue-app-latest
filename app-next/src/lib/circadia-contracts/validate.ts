/**
 * Circadia edge ↔ server contracts (Scope V3).
 * Validators mirror docs/architecture/schemas/*.schema.json — keep in sync.
 *
 * @see docs/architecture/schemas/README.md
 */

export const CAMERA_RISK_PACKET_V2 = 2 as const;
export const EDGE_SESSION_INIT_V1 = 1 as const;
export const EVIDENCE_CAPSULE_V1 = 1 as const;
export const VAULT_ACK_V1 = 1 as const;

export const CAMERA_RISK_BLOCK_MINUTES = 15;

export type CameraRiskOperationalFlagsV2 = {
  silent_observation_mode: boolean;
  suspect_pre_fatigue?: boolean;
  unintended_drift_anomaly?: boolean;
  haptic_fired_in_block?: boolean;
  main_sequence_decoupling?: boolean;
  cognitive_tunneling?: boolean;
  nodding_micro_sleep?: boolean;
};

export type CameraRiskMetricsV2 = {
  drowsiness_score?: number;
  distraction_score?: number;
  eyes_off_road_seconds?: number;
  yawn_count?: number;
  head_nod_count?: number;
  sample_coverage_pct?: number;
  steering_entropy?: number;
  control_entropy_1_3hz?: number;
  eyelid_velocity_mean?: number;
  eyelid_velocity_ratio_vs_baseline?: number;
  steering_entropy_ratio_vs_baseline?: number;
  distraction_clock_seconds?: number;
  ear_mean?: number;
  steering_flatline_seconds?: number;
  gaze_shift_velocity_mean?: number;
  fixation_duration_max_seconds?: number;
  head_yaw_velocity_mean?: number;
  inter_movement_latency_mean_ms?: number;
  saccade_peak_velocity_ratio_vs_baseline?: number;
};

export type CameraRiskPacketV2 = {
  schema_version: typeof CAMERA_RISK_PACKET_V2;
  packet_id: string;
  device_id: string;
  session_id?: string;
  block_start: string;
  block_minutes: typeof CAMERA_RISK_BLOCK_MINUTES;
  metrics: CameraRiskMetricsV2;
  operational_flags: CameraRiskOperationalFlagsV2;
  vendor?: Record<string, unknown>;
};

export type EdgeSessionInitV1 = {
  schema_version: typeof EDGE_SESSION_INIT_V1;
  session_id: string;
  device_id: string;
  driver_id_uuid?: string;
  tenant_id_uuid?: string;
  fit_for_work_acknowledged: boolean;
  acknowledged_at: string;
  tpma_process_s_baseline?: 0;
  enrollment_audit?: {
    departure_detected_at?: string;
    completed: boolean;
    frames_analyzed: number;
    duration_seconds?: number;
    eyelid_velocity_mean?: number;
    steering_entropy_mean?: number;
    eyelid_velocity_ratio_vs_baseline?: number;
    steering_entropy_ratio_vs_baseline?: number;
    suspect_pre_fatigue?: boolean;
    process_s_accumulation_multiplier?: 1 | 1.4;
  };
  operational_flags: { silent_observation_mode: boolean };
};

export type EvidenceCapsuleTriggerV1 =
  | "fatigue_milestone"
  | "drift_anomaly"
  | "suspect_pre_fatigue"
  | "driver_dispute"
  | "cognitive_tunneling"
  | "main_sequence_decoupling"
  | "nodding_micro_sleep";

export type EvidenceCapsuleV1 = {
  schema_version: typeof EVIDENCE_CAPSULE_V1;
  capsule_id: string;
  device_id: string;
  session_id: string;
  driver_id_uuid?: string;
  tenant_id_uuid?: string;
  created_at: string;
  duration_seconds: 30;
  trigger_type: EvidenceCapsuleTriggerV1;
  technical: {
    summary_metrics?: Record<string, number>;
    ear_samples_hz?: number;
    frame_count?: number;
  };
  narrative?: { manager_summary?: string; driver_summary?: string };
  media_refs?: Array<{
    ref_id: string;
    media_type: "ir_frame" | "mjpeg_snippet" | "telemetry_json";
    sha256: string;
    bytes?: number;
  }>;
  telemetry_snapshot?: Record<string, unknown>;
  operational_flags: {
    silent_observation_mode: boolean;
    promote_to_command?: boolean;
  };
  linked_lifecycle_id?: string;
};

export type VaultAckV1 = {
  schema_version: typeof VAULT_ACK_V1;
  capsule_id: string;
  ack_token: string;
  vault_path_acknowledged: string;
  acknowledged_at: string;
  status: "stored";
  server_storage_key?: string;
};

export type ValidateResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseIso(s: unknown): boolean {
  return typeof s === "string" && Number.isFinite(Date.parse(s));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function numInRange(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

export function validateCameraRiskPacketV2(raw: unknown): ValidateResult<CameraRiskPacketV2> {
  if (!isObject(raw)) return { ok: false, error: "Packet must be an object" };
  if (raw.schema_version !== CAMERA_RISK_PACKET_V2) {
    return { ok: false, error: `Unsupported schema_version (expected ${CAMERA_RISK_PACKET_V2})` };
  }
  if (typeof raw.packet_id !== "string" || !raw.packet_id.trim()) {
    return { ok: false, error: "packet_id required" };
  }
  if (typeof raw.device_id !== "string" || !raw.device_id.trim()) {
    return { ok: false, error: "device_id required" };
  }
  if (!parseIso(raw.block_start)) return { ok: false, error: "block_start must be ISO-8601" };
  if (raw.block_minutes !== CAMERA_RISK_BLOCK_MINUTES) {
    return { ok: false, error: `block_minutes must be ${CAMERA_RISK_BLOCK_MINUTES}` };
  }
  if (!isObject(raw.metrics)) return { ok: false, error: "metrics required" };
  if (!isObject(raw.operational_flags)) return { ok: false, error: "operational_flags required" };
  if (typeof raw.operational_flags.silent_observation_mode !== "boolean") {
    return { ok: false, error: "operational_flags.silent_observation_mode required" };
  }

  const m = raw.metrics;
  const metrics: CameraRiskMetricsV2 = {
    drowsiness_score: numInRange(m.drowsiness_score, 0, 1),
    distraction_score: numInRange(m.distraction_score, 0, 1),
    eyes_off_road_seconds: numInRange(m.eyes_off_road_seconds, 0, 900),
    yawn_count:
      m.yawn_count === undefined ? undefined : Math.max(0, Math.floor(Number(m.yawn_count))),
    head_nod_count:
      m.head_nod_count === undefined ? undefined : Math.max(0, Math.floor(Number(m.head_nod_count))),
    sample_coverage_pct: numInRange(m.sample_coverage_pct, 0, 100),
    steering_entropy: numInRange(m.steering_entropy, 0, 1),
    control_entropy_1_3hz:
      m.control_entropy_1_3hz === undefined ? undefined : Math.max(0, Number(m.control_entropy_1_3hz)),
    eyelid_velocity_mean:
      m.eyelid_velocity_mean === undefined ? undefined : Math.max(0, Number(m.eyelid_velocity_mean)),
    eyelid_velocity_ratio_vs_baseline: numInRange(m.eyelid_velocity_ratio_vs_baseline, 0, 2),
    steering_entropy_ratio_vs_baseline: numInRange(m.steering_entropy_ratio_vs_baseline, 0, 2),
    distraction_clock_seconds:
      m.distraction_clock_seconds === undefined
        ? undefined
        : Math.max(0, Number(m.distraction_clock_seconds)),
    ear_mean: numInRange(m.ear_mean, 0, 1),
    steering_flatline_seconds:
      m.steering_flatline_seconds === undefined
        ? undefined
        : Math.max(0, Number(m.steering_flatline_seconds)),
    gaze_shift_velocity_mean:
      m.gaze_shift_velocity_mean === undefined
        ? undefined
        : Math.max(0, Number(m.gaze_shift_velocity_mean)),
    fixation_duration_max_seconds:
      m.fixation_duration_max_seconds === undefined
        ? undefined
        : Math.max(0, Number(m.fixation_duration_max_seconds)),
    head_yaw_velocity_mean:
      m.head_yaw_velocity_mean === undefined ? undefined : Math.max(0, Number(m.head_yaw_velocity_mean)),
    inter_movement_latency_mean_ms:
      m.inter_movement_latency_mean_ms === undefined
        ? undefined
        : Math.max(0, Number(m.inter_movement_latency_mean_ms)),
    saccade_peak_velocity_ratio_vs_baseline: numInRange(
      m.saccade_peak_velocity_ratio_vs_baseline,
      0,
      2
    ),
  };

  const flags = raw.operational_flags;
  const operational_flags: CameraRiskOperationalFlagsV2 = {
    silent_observation_mode: flags.silent_observation_mode as boolean,
    suspect_pre_fatigue: flags.suspect_pre_fatigue === true,
    unintended_drift_anomaly: flags.unintended_drift_anomaly === true,
    haptic_fired_in_block: flags.haptic_fired_in_block === true,
    main_sequence_decoupling: flags.main_sequence_decoupling === true,
    cognitive_tunneling: flags.cognitive_tunneling === true,
    nodding_micro_sleep: flags.nodding_micro_sleep === true,
  };

  return {
    ok: true,
    value: {
      schema_version: CAMERA_RISK_PACKET_V2,
      packet_id: raw.packet_id.trim(),
      device_id: raw.device_id.trim(),
      session_id: typeof raw.session_id === "string" ? raw.session_id.trim() : undefined,
      block_start: raw.block_start as string,
      block_minutes: CAMERA_RISK_BLOCK_MINUTES,
      metrics,
      operational_flags,
      vendor: isObject(raw.vendor) ? raw.vendor : undefined,
    },
  };
}

export function validateEdgeSessionInitV1(raw: unknown): ValidateResult<EdgeSessionInitV1> {
  if (!isObject(raw)) return { ok: false, error: "Body must be an object" };
  if (raw.schema_version !== EDGE_SESSION_INIT_V1) {
    return { ok: false, error: `Unsupported schema_version (expected ${EDGE_SESSION_INIT_V1})` };
  }
  if (typeof raw.session_id !== "string" || !raw.session_id.trim()) {
    return { ok: false, error: "session_id required" };
  }
  if (typeof raw.device_id !== "string" || !raw.device_id.trim()) {
    return { ok: false, error: "device_id required" };
  }
  if (typeof raw.fit_for_work_acknowledged !== "boolean") {
    return { ok: false, error: "fit_for_work_acknowledged required" };
  }
  if (!parseIso(raw.acknowledged_at)) return { ok: false, error: "acknowledged_at must be ISO-8601" };
  if (!isObject(raw.operational_flags)) return { ok: false, error: "operational_flags required" };
  if (typeof raw.operational_flags.silent_observation_mode !== "boolean") {
    return { ok: false, error: "operational_flags.silent_observation_mode required" };
  }

  let enrollment_audit: EdgeSessionInitV1["enrollment_audit"];
  if (raw.enrollment_audit !== undefined) {
    if (!isObject(raw.enrollment_audit)) return { ok: false, error: "enrollment_audit invalid" };
    const e = raw.enrollment_audit;
    if (typeof e.completed !== "boolean") return { ok: false, error: "enrollment_audit.completed required" };
    const frames = Number(e.frames_analyzed);
    if (!Number.isFinite(frames) || frames < 0 || frames > 30000) {
      return { ok: false, error: "enrollment_audit.frames_analyzed must be 0–30000" };
    }
    enrollment_audit = {
      departure_detected_at:
        typeof e.departure_detected_at === "string" ? e.departure_detected_at : undefined,
      completed: e.completed,
      frames_analyzed: frames,
      duration_seconds: numInRange(e.duration_seconds, 0, 600),
      eyelid_velocity_mean:
        e.eyelid_velocity_mean === undefined ? undefined : Math.max(0, Number(e.eyelid_velocity_mean)),
      steering_entropy_mean: numInRange(e.steering_entropy_mean, 0, 1),
      eyelid_velocity_ratio_vs_baseline: numInRange(e.eyelid_velocity_ratio_vs_baseline, 0, 2),
      steering_entropy_ratio_vs_baseline: numInRange(e.steering_entropy_ratio_vs_baseline, 0, 2),
      suspect_pre_fatigue: e.suspect_pre_fatigue === true,
      process_s_accumulation_multiplier:
        e.process_s_accumulation_multiplier === 1.4 ? 1.4 : e.process_s_accumulation_multiplier === 1 ? 1 : undefined,
    };
  }

  if (raw.fit_for_work_acknowledged && raw.tpma_process_s_baseline !== undefined && raw.tpma_process_s_baseline !== 0) {
    return { ok: false, error: "tpma_process_s_baseline must be 0 when set" };
  }

  return {
    ok: true,
    value: {
      schema_version: EDGE_SESSION_INIT_V1,
      session_id: raw.session_id.trim(),
      device_id: raw.device_id.trim(),
      driver_id_uuid: typeof raw.driver_id_uuid === "string" ? raw.driver_id_uuid : undefined,
      tenant_id_uuid: typeof raw.tenant_id_uuid === "string" ? raw.tenant_id_uuid : undefined,
      fit_for_work_acknowledged: raw.fit_for_work_acknowledged,
      acknowledged_at: raw.acknowledged_at as string,
      tpma_process_s_baseline: raw.tpma_process_s_baseline === 0 ? 0 : undefined,
      enrollment_audit,
      operational_flags: {
        silent_observation_mode: raw.operational_flags.silent_observation_mode as boolean,
      },
    },
  };
}

const CAPSULE_TRIGGERS = new Set<EvidenceCapsuleTriggerV1>([
  "fatigue_milestone",
  "drift_anomaly",
  "suspect_pre_fatigue",
  "driver_dispute",
  "cognitive_tunneling",
  "main_sequence_decoupling",
  "nodding_micro_sleep",
]);

export function validateEvidenceCapsuleV1(raw: unknown): ValidateResult<EvidenceCapsuleV1> {
  if (!isObject(raw)) return { ok: false, error: "Capsule must be an object" };
  if (raw.schema_version !== EVIDENCE_CAPSULE_V1) {
    return { ok: false, error: `Unsupported schema_version (expected ${EVIDENCE_CAPSULE_V1})` };
  }
  if (typeof raw.capsule_id !== "string" || !raw.capsule_id.trim()) {
    return { ok: false, error: "capsule_id required" };
  }
  if (typeof raw.device_id !== "string" || !raw.device_id.trim()) {
    return { ok: false, error: "device_id required" };
  }
  if (typeof raw.session_id !== "string" || !raw.session_id.trim()) {
    return { ok: false, error: "session_id required" };
  }
  if (!parseIso(raw.created_at)) return { ok: false, error: "created_at must be ISO-8601" };
  if (raw.duration_seconds !== 30) return { ok: false, error: "duration_seconds must be 30" };
  if (typeof raw.trigger_type !== "string" || !CAPSULE_TRIGGERS.has(raw.trigger_type as EvidenceCapsuleTriggerV1)) {
    return { ok: false, error: "trigger_type invalid" };
  }
  if (!isObject(raw.technical)) return { ok: false, error: "technical required" };
  if (!isObject(raw.operational_flags)) return { ok: false, error: "operational_flags required" };
  if (typeof raw.operational_flags.silent_observation_mode !== "boolean") {
    return { ok: false, error: "operational_flags.silent_observation_mode required" };
  }

  return {
    ok: true,
    value: {
      schema_version: EVIDENCE_CAPSULE_V1,
      capsule_id: raw.capsule_id.trim(),
      device_id: raw.device_id.trim(),
      session_id: raw.session_id.trim(),
      driver_id_uuid: typeof raw.driver_id_uuid === "string" ? raw.driver_id_uuid : undefined,
      tenant_id_uuid: typeof raw.tenant_id_uuid === "string" ? raw.tenant_id_uuid : undefined,
      created_at: raw.created_at as string,
      duration_seconds: 30,
      trigger_type: raw.trigger_type as EvidenceCapsuleTriggerV1,
      technical: {
        summary_metrics: isObject(raw.technical.summary_metrics)
          ? (raw.technical.summary_metrics as Record<string, number>)
          : undefined,
        ear_samples_hz:
          raw.technical.ear_samples_hz === undefined
            ? undefined
            : Number(raw.technical.ear_samples_hz),
        frame_count:
          raw.technical.frame_count === undefined
            ? undefined
            : Math.max(0, Math.floor(Number(raw.technical.frame_count))),
      },
      narrative: isObject(raw.narrative)
        ? {
            manager_summary:
              typeof raw.narrative.manager_summary === "string"
                ? raw.narrative.manager_summary
                : undefined,
            driver_summary:
              typeof raw.narrative.driver_summary === "string"
                ? raw.narrative.driver_summary
                : undefined,
          }
        : undefined,
      media_refs: Array.isArray(raw.media_refs)
        ? (raw.media_refs as EvidenceCapsuleV1["media_refs"])
        : undefined,
      telemetry_snapshot: isObject(raw.telemetry_snapshot) ? raw.telemetry_snapshot : undefined,
      operational_flags: {
        silent_observation_mode: raw.operational_flags.silent_observation_mode as boolean,
        promote_to_command: raw.operational_flags.promote_to_command === true,
      },
      linked_lifecycle_id:
        typeof raw.linked_lifecycle_id === "string" ? raw.linked_lifecycle_id : undefined,
    },
  };
}

export function validateVaultAckV1(raw: unknown): ValidateResult<VaultAckV1> {
  if (!isObject(raw)) return { ok: false, error: "Ack must be an object" };
  if (raw.schema_version !== VAULT_ACK_V1) {
    return { ok: false, error: `Unsupported schema_version (expected ${VAULT_ACK_V1})` };
  }
  if (typeof raw.capsule_id !== "string" || !raw.capsule_id.trim()) {
    return { ok: false, error: "capsule_id required" };
  }
  if (typeof raw.ack_token !== "string" || raw.ack_token.length < 32) {
    return { ok: false, error: "ack_token must be at least 32 characters" };
  }
  if (typeof raw.vault_path_acknowledged !== "string" || !raw.vault_path_acknowledged.trim()) {
    return { ok: false, error: "vault_path_acknowledged required" };
  }
  if (!parseIso(raw.acknowledged_at)) return { ok: false, error: "acknowledged_at must be ISO-8601" };
  if (raw.status !== "stored") return { ok: false, error: "status must be stored" };

  return {
    ok: true,
    value: {
      schema_version: VAULT_ACK_V1,
      capsule_id: raw.capsule_id.trim(),
      ack_token: raw.ack_token,
      vault_path_acknowledged: raw.vault_path_acknowledged.trim(),
      acknowledged_at: raw.acknowledged_at as string,
      status: "stored",
      server_storage_key:
        typeof raw.server_storage_key === "string" ? raw.server_storage_key : undefined,
    },
  };
}

/** Domain checks beyond schema shape (Engines 1–3 thresholds from Scope V3). */
export function assertEngineThresholds(packet: CameraRiskPacketV2): string[] {
  const warnings: string[] = [];
  const m = packet.metrics;
  const f = packet.operational_flags;

  // Engine 1: enrollment / pre-fatigue — not applicable when drift anomaly explains low ratios.
  if (!f.unintended_drift_anomaly) {
    if (m.eyelid_velocity_ratio_vs_baseline != null && m.eyelid_velocity_ratio_vs_baseline < 0.75) {
      if (!f.suspect_pre_fatigue) {
        warnings.push("eyelid_velocity_ratio < 0.75 but suspect_pre_fatigue is false");
      }
    }
    if (m.steering_entropy_ratio_vs_baseline != null && m.steering_entropy_ratio_vs_baseline < 0.6) {
      if (!f.suspect_pre_fatigue) {
        warnings.push("steering_entropy_ratio < 0.60 but suspect_pre_fatigue is false");
      }
    }
  }
  // Engine 2: unintended drift
  if (f.unintended_drift_anomaly) {
    const entropy = m.steering_entropy ?? 1;
    if (entropy >= 0.05) {
      warnings.push("unintended_drift_anomaly set but steering_entropy >= 0.05");
    }
    if ((m.distraction_clock_seconds ?? 0) <= 0) {
      warnings.push("unintended_drift_anomaly set but distraction_clock_seconds is 0");
    }
  }
  if (f.unintended_drift_anomaly && f.silent_observation_mode && f.haptic_fired_in_block) {
    warnings.push("silent_observation_mode true but haptic_fired_in_block true");
  }
  // Engine 3: oculomotor kinematics
  if (f.main_sequence_decoupling) {
    const ratio = m.saccade_peak_velocity_ratio_vs_baseline ?? 1;
    if (ratio >= 0.7) {
      warnings.push("main_sequence_decoupling set but saccade_peak_velocity_ratio >= 0.70");
    }
  }
  if (f.cognitive_tunneling) {
    const fixation = m.fixation_duration_max_seconds ?? 0;
    if (fixation <= 3.5) {
      warnings.push("cognitive_tunneling set but fixation_duration_max_seconds <= 3.5");
    }
  }
  if (f.nodding_micro_sleep && f.main_sequence_decoupling && f.cognitive_tunneling) {
    warnings.push("nodding_micro_sleep should not co-occur with both decoupling and tunneling");
  }
  return warnings;
}

export function extractCameraFeaturesV2(packet: CameraRiskPacketV2) {
  const m = packet.metrics;
  return {
    drowsinessScore: clamp01(m.drowsiness_score ?? 0),
    distractionScore: clamp01(m.distraction_score ?? 0),
    eyesOffRoadSeconds: Math.max(0, m.eyes_off_road_seconds ?? 0),
    sampleCoveragePct: Math.min(100, Math.max(0, m.sample_coverage_pct ?? 0)),
    yawnCount: Math.max(0, Math.floor(m.yawn_count ?? 0)),
    headNodCount: Math.max(0, Math.floor(m.head_nod_count ?? 0)),
    steeringEntropy: m.steering_entropy ?? null,
    unintendedDriftAnomaly: packet.operational_flags.unintended_drift_anomaly === true,
    suspectPreFatigue: packet.operational_flags.suspect_pre_fatigue === true,
    cognitiveTunneling: packet.operational_flags.cognitive_tunneling === true,
    mainSequenceDecoupling: packet.operational_flags.main_sequence_decoupling === true,
    noddingMicroSleep: packet.operational_flags.nodding_micro_sleep === true,
  };
}
