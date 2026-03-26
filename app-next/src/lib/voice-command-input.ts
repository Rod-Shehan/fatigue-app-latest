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

/** Marketing faux wake — spoken in the same utterance as the command (no second listen). */
export const WAKE_PHRASE_DISPLAY = "Hey Circadia";

const WAKE_PREFIX = "hey circadia";

/**
 * Single phrase: "Hey Circadia" + command in one go, e.g. "Hey Circadia start shift".
 * Avoids tap-then-wait-then-command (double handling). Still requires one mic tap for the browser.
 */
export function matchWakeAndCommand(transcript: string): { intent: VoiceIntent; matchedPhrase: string } | null {
  const n = normalizeVoiceTranscript(transcript);
  if (!n.startsWith(WAKE_PREFIX)) return null;
  let rest = n.slice(WAKE_PREFIX.length).trim();
  rest = rest.replace(/^,\s*/, "").trim();
  if (!rest) return null;
  return matchStrictVoiceIntent(rest);
}

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
export const VOICE_COMMAND_HINT = `Say one phrase: "${WAKE_PHRASE_DISPLAY}" plus your command — e.g. "${WAKE_PHRASE_DISPLAY} start shift".`;
