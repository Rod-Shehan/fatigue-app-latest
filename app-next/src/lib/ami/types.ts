/**
 * AMI Phase 1 types — absolute minute tape + events.
 * Calendar day / week are not part of this model.
 */

export type AmiEventType = "work" | "break" | "other_work" | "non_work" | "stop";

export type AmiEvent = {
  time: string;
  type: AmiEventType;
};

/** Painted / reclassified activity at one AMI minute (no `stop` — stop is a point event). */
export type AmiKind = "work" | "break" | "other_work" | "non_work";

export type AmiTape = {
  /** Inclusive start of minute 0 (epoch ms, aligned to minute). */
  originMs: number;
  /** Exclusive end of the last minute (originMs + length * 60_000). */
  endMs: number;
  /** length === number of minutes; kinds[i] covers [originMs + i*60k, originMs + (i+1)*60k). */
  kinds: AmiKind[];
};

export type AmiSegment = {
  startMinute: number; // inclusive index on tape
  endMinute: number; // exclusive
  kind: AmiKind;
};
