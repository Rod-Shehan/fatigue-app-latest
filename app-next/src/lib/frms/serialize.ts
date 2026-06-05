import type { FrmsProfileRun, FrmsRiskSnapshot } from "@prisma/client";

/** JSON-safe snapshot row (BigInt → string). */
export function serializeFrmsSnapshot(row: FrmsRiskSnapshot) {
  return {
    id: row.id,
    run_id: row.runId,
    block_start_ms: row.blockStartMs.toString(),
    block_minutes: row.blockMinutes,
    process_s_pct: row.processSPct,
    process_c_pct: row.processCPct,
    model_pct: row.modelPct,
    combined_pct: row.combinedPct,
    band: row.band,
    created_at: row.createdAt.toISOString(),
  };
}

/** JSON-safe profile run (BigInt → string). */
export function serializeFrmsProfileRun(row: FrmsProfileRun) {
  return {
    id: row.id,
    driver_name: row.driverName,
    user_id: row.userId,
    week_starting: row.weekStarting,
    horizon_from_ms: row.horizonFromMs.toString(),
    horizon_to_ms: row.horizonToMs.toString(),
    timezone: row.timezone,
    engine_version: row.engineVersion,
    model_version: row.modelVersion,
    input_hash: row.inputHash,
    status: row.status,
    error_message: row.errorMessage,
    sources: row.sources,
    prospective_register: row.prospectiveRegister,
    requested_at: row.requestedAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
  };
}
