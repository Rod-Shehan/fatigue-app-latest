/**
 * Strict voice commands for shift logging (marketing / hands-free trial).
 * Only whitelisted phrases map to intents; everything else is rejected.
 * Recognition uses the browser Web Speech API (Chrome/Android; Safari/iOS varies).
 */

import {
  DRIVER_CONTINUE_SHIFT_LABEL,
  DRIVER_END_SHIFT_LABEL,
  DRIVER_LOAD_CHECK_LABEL,
  DRIVER_NAP_QUESTION_COMPACT_LABEL,
  DRIVER_NAP_QUESTION_LABEL,
  DRIVER_PARKED_LABEL,
  DRIVER_PASSENGER_LABEL,
  DRIVER_SLEEPER_BERTH_LABEL,
  DRIVER_START_DRIVING_LABEL,
  DRIVER_START_OTHER_WORK_LABEL,
  DRIVER_START_REST_LABEL,
  DRIVER_START_SHIFT_LABEL,
  DRIVER_START_WORK_LABEL,
  DRIVER_STOP_DRIVING_LABEL,
} from "@/lib/product-copy";

export type VoiceIntent =
  | "work"
  | "start_driving"
  | "start_work"
  | "break"
  | "other_work"
  | "stop_driving"
  | "stop"
  | "load_check"
  | "nap"
  | "passenger"
  | "sleeper_berth"
  | "parked";

const VOICE_INTENTS: readonly VoiceIntent[] = [
  "start_driving",
  "start_work",
  "work",
  "break",
  "other_work",
  "stop_driving",
  "stop",
  "load_check",
  "nap",
  "passenger",
  "sleeper_berth",
  "parked",
];

/** Normalise transcript for exact phrase matching only (strict). */
export function normalizeVoiceTranscript(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phraseFromLabel(label: string): string {
  return normalizeVoiceTranscript(label);
}

/**
 * Allowed phrases → intent. Matching is exact on the normalised string
 * (optional trailing " now" allowed). Hero button words plus a few short aliases.
 */
const PHRASES: Record<VoiceIntent, readonly string[]> = {
  work: [
    phraseFromLabel(DRIVER_START_SHIFT_LABEL),
    "start my shift",
    "begin shift",
    phraseFromLabel(DRIVER_CONTINUE_SHIFT_LABEL),
    "log work",
  ],
  start_driving: [phraseFromLabel(DRIVER_START_DRIVING_LABEL)],
  start_work: [phraseFromLabel(DRIVER_START_WORK_LABEL)],
  break: [
    phraseFromLabel(DRIVER_START_REST_LABEL),
    "take a rest",
    "take a break",
    "start break",
    "log break",
  ],
  other_work: [phraseFromLabel(DRIVER_START_OTHER_WORK_LABEL), "other work", "log other work"],
  stop_driving: [phraseFromLabel(DRIVER_STOP_DRIVING_LABEL)],
  stop: [
    phraseFromLabel(DRIVER_END_SHIFT_LABEL),
    "end my shift",
    "finish shift",
    "finish my shift",
    "stop shift",
  ],
  load_check: [phraseFromLabel(DRIVER_LOAD_CHECK_LABEL)],
  nap: [phraseFromLabel(DRIVER_NAP_QUESTION_LABEL), phraseFromLabel(DRIVER_NAP_QUESTION_COMPACT_LABEL)],
  passenger: [phraseFromLabel(DRIVER_PASSENGER_LABEL)],
  sleeper_berth: [phraseFromLabel(DRIVER_SLEEPER_BERTH_LABEL)],
  parked: [phraseFromLabel(DRIVER_PARKED_LABEL)],
};

export function matchStrictVoiceIntent(transcript: string): { intent: VoiceIntent; matchedPhrase: string } | null {
  const n = normalizeVoiceTranscript(transcript);
  if (!n) return null;
  const variants = [n, n.replace(/ now$/, "").trim()].filter((x, i, a) => a.indexOf(x) === i);
  for (const candidate of variants) {
    for (const intent of VOICE_INTENTS) {
      for (const phrase of PHRASES[intent]) {
        if (candidate === phrase || candidate === `${phrase} now`) {
          return { intent, matchedPhrase: phrase };
        }
      }
    }
  }
  return null;
}

/** Phrases for the confirmation dialog (strict match on normalised transcript). */
const CONFIRM_YES: readonly string[] = [
  "yes",
  "yeah",
  "yep",
  "confirm",
  "correct",
  "proceed",
  "do it",
  "ok",
  "okay",
  "absolutely",
  "sure",
  "affirmative",
  "thats right",
  "yes log it",
  "log it",
];

const CONFIRM_NO: readonly string[] = [
  "no",
  "nope",
  "cancel",
  "abort",
  "negative",
  "dont",
  "never mind",
  "no thanks",
];

/**
 * Match yes/no for the post-command confirmation step.
 * Returns null if the transcript does not match an allowed phrase.
 */
export function matchVoiceConfirmTranscript(transcript: string): "yes" | "no" | null {
  const n = normalizeVoiceTranscript(transcript);
  if (!n) return null;
  const variants = [n, n.replace(/ now$/, "").trim()].filter((x, i, a) => a.indexOf(x) === i);
  for (const candidate of variants) {
    if (CONFIRM_YES.some((p) => candidate === p || candidate === `${p} now`)) return "yes";
    if (CONFIRM_NO.some((p) => candidate === p || candidate === `${p} now`)) return "no";
  }
  return null;
}

/** Hint shown when confirmation listening did not understand. */
export const VOICE_CONFIRM_HINT = 'Say "yes" or "no", or use the buttons below.';

/** Minimal typing; DOM lib may not include SpeechRecognition. */
export type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
};

export function getSpeechRecognitionConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceCommandInputSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

/** Short hint for UI when recognition is unavailable or user needs examples. */
export const VOICE_COMMAND_HINT =
  'Say a button phrase, e.g. "start driving", "start rest", "load check", or "end shift".';
