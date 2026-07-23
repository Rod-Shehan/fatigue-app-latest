/**
 * AMI (Activity Measurement Interval) — Phase 1 constants.
 * Unwired: not yet the live compliance engine. See `src/lib/ami/index.ts`.
 */

/** Coverage reclass */
export const AMI_SHORT_GAP_AS_BREAK_MAX = 30;
export const AMI_LONG_BREAK_AS_NON_WORK_MIN = 31;
export const AMI_MICRO_BREAK_AS_WORK_MAX = 9; // completed break < 10 → work

/** 5h break-from-driving — Reg 184E(1)(a) */
export const AMI_WORK_WINDOW = 300;
export const AMI_QUAL_BREAK_FRAGMENT = 10;
export const AMI_QUAL_BREAK_TOTAL = 20;

/** Between shifts / solo rest */
export const AMI_SOLO_BETWEEN_SHIFT_REST = 420; // 7h
export const AMI_TWO_UP_24H_WINDOW = 1440;
export const AMI_TWO_UP_24H_MIN_NON_WORK = 420;

/** Solo 17h episode */
export const AMI_NON_WORK_ANCHOR = 420; // 7h
export const AMI_17H_WORK_BREAK_CEILING = 1020; // 17h
export const AMI_17H_LOOKBACK = 4320; // 72h

/** Solo 72h — Reg 184E(2)(a) */
export const AMI_72H_WINDOW = 4320;
export const AMI_72H_MIN_TOTAL_NON_WORK = 1620; // 27h
export const AMI_72H_QUAL_BLOCK = 420; // 7h
export const AMI_72H_QUAL_BLOCK_COUNT = 3;
export const AMI_72H_MAX_GAP_BETWEEN_QUAL_BLOCKS = 1020; // 17h
/** ≥24h continuous no-work soft-resets the 72h package (see docs/regulatory/24h-soft-reset-doctrine.md). */
export const AMI_72H_SOFT_RESET_NO_WORK = 1440;
/** Lookback so a reset before the 72h window is still visible on the eval tape. */
export const AMI_72H_EVAL_LOOKBACK = AMI_72H_WINDOW + AMI_72H_SOFT_RESET_NO_WORK * 4;

/** 168h / 14-day work — Reg 184E(1)(b) */
export const AMI_14D_WINDOW = 20160;
export const AMI_168H_MAX_WORK = 10080;
export const AMI_168H_WARN_WORK = 8400;
export const AMI_168H_RESET_NON_WORK = 2880; // 48h

/** Solo 14-day long rests — Reg 184E(2)(b)(i) */
export const AMI_14D_LONG_REST_BLOCK = 1440; // 24h
export const AMI_14D_LONG_REST_COUNT = 2;

/** Two-up 48h / 7-day — Reg 184E(3)(b) */
export const AMI_48H_WINDOW = 2880;
export const AMI_48H_MIN_CONTINUOUS_NON_WORK = 420;
export const AMI_7D_WINDOW = 10080;
export const AMI_7D_MIN_TOTAL_NON_WORK = 2880;
export const AMI_7D_MIN_CONTINUOUS_BLOCK = 1440;
export const AMI_7D_MIN_NON_WORK_PIECE = 420;

/** Shift pattern change — Reg 184E(4) */
export const AMI_PATTERN_STREAK = 7200; // 120h
export const AMI_PATTERN_CHANGE_REST = 1440; // 24h
