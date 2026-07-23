/**
 * AMI (Activity Measurement Interval) compliance core.
 *
 * Status: **Phase 4** — dual-run parity tightened; optional WA overlay still
 * behind AMI_COMPLIANCE_ENGINE_ENABLED (default off). No engine deletes.
 *
 * Locked:
 * - Reclass 30 / <10→work / ≥31→non_work before evaluation
 * - Solo 17h episode resume after End shift (keep)
 * - 184E(4) primary AMI measure: only `work` interrupts pattern-change rest
 * - Continuous-non_work variant exported for comparison only
 */

export * from "./constants";
export * from "./types";
export {
  alignToMinuteMs,
  eventTimeMs,
  lastAmiEventAt,
  openKindAtAsOf,
  paintAmiTape,
  segmentsFromTape,
  sortAmiEvents,
  tapeMinuteToMs,
} from "./paint";
export { reclassifyAmiTape, buildReclassifiedAmiTape } from "./reclassify";
export {
  applyQualifyingBreakToSlots,
  buildEvalTape,
  evaluate168hWork,
  evaluateFiveHourBreakRule,
  evaluateSeventeenHourEpisode,
  evaluateSolo14dLongRests,
  evaluateSolo72h,
  evaluateSoloBetweenShiftRest,
  evaluateTwoUp24hRest,
  evaluateTwoUp48hOption,
  evaluateTwoUp7dOption,
  measurePatternChangeRestContinuousNonWork,
  measurePatternChangeRestOnlyWorkInterrupts,
  patternChangeRestMet,
  qualifyingRestComplete,
} from "./evaluate";
export { isAmiComplianceEngineEnabled } from "./flag";
export { runWaComplianceChecks } from "./compliance-bridge";
export {
  formatDualRunMarkdown,
  runDualRunFixture,
  summarizeDualRun,
  eventsToDerivedDays,
} from "./dual-run";
export type { DualRunFixture, DualRunRow, DualRunStatus } from "./dual-run";
export { DUAL_RUN_FIXTURES } from "./dual-run.fixtures";
