/**
 * Strict voice commands for shift logging (marketing / hands-free trial).
 * Only whitelisted phrases map to intents; everything else is rejected.
 * Recognition uses the browser Web Speech API (Chrome/Android; Safari/iOS varies).
 */

export type VoiceIntent = "work" | "break" | "stop";

/** Normalise transcript for exact phrase matching only (strict). */
export function normalizeVoiceTranscript(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Allowed phrases → intent. Matching is exact on the normalised string
 * (optional trailing " now" allowed). Phrases are short, natural things a
 * driver would say — easier for STT and less ambiguous than single words.
 */
const PHRASES: Record<VoiceIntent, readonly string[]> = {
  work: ["start shift", "start my shift", "begin shift", "log work"],
  break: ["take a break", "start break", "rest break", "log break"],
  stop: ["end shift", "end my shift", "finish shift", "finish my shift", "stop shift"],
} as const;

export function matchStrictVoiceIntent(transcript: string): { intent: VoiceIntent; matchedPhrase: string } | null {
  const n = normalizeVoiceTranscript(transcript);
  if (!n) return null;
  const variants = [n, n.replace(/ now$/, "").trim()].filter((x, i, a) => a.indexOf(x) === i);
  for (const candidate of variants) {
    for (const intent of ["work", "break", "stop"] as const) {
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
  'Say a command phrase, e.g. "start shift", "take a break", or "end shift".';
