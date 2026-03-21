/**
 * Phase 1 driver voice alerts: browser text-to-speech when enabled (localStorage).
 * Requires a user gesture to enable; many browsers block speech until then.
 */

const STORAGE_KEY = "fatigue-voice-alerts-enabled";

export function getVoiceAlertsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceAlertsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Speak a short phrase if voice alerts are on and Web Speech API exists. */
export function speakVoiceAlert(text: string): void {
  if (typeof window === "undefined") return;
  if (!getVoiceAlertsEnabled()) return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-AU";
    u.rate = 0.95;
    synth.speak(u);
  } catch {
    /* ignore */
  }
}
