import type { QueueIncident } from "@/hooks/use-triage-queue";

const MUTE_STORAGE_KEY = "command:fatigueAlertMuted";
const ARMED_AT_STORAGE_KEY = "command:fatigueAlertArmedAt";
/** SSE reconnect catch-up: only ring if the event is this recent. */
export const FATIGUE_ALERT_CATCH_UP_MS = 90_000;

/** Bundled desk alarm (850 Hz square @ 120 BPM, ~2.5 s). */
export const COMMAND_ALARM_SOUND_URL = "/sounds/command-alarm.wav";

const playedLifecycleIds = new Set<string>();

let audioContext: AudioContext | null = null;
let alarmAudio: HTMLAudioElement | null = null;

export function isFatigueMetricType(fatigueMetricType: string | null | undefined): boolean {
  const normalized = String(fatigueMetricType ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return normalized === "FATIGUE";
}

/** Any incident in the triage queue should ring the desk alarm (FATIGUE, DISTRACTION, …). */
export function isTriageAlertMetricType(fatigueMetricType: string | null | undefined): boolean {
  const normalized = String(fatigueMetricType ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return normalized.length > 0;
}

export function isFatigueAlertCatchUpIncident(incident: Pick<QueueIncident, "detected_at">): boolean {
  const detectedMs = Date.parse(incident.detected_at);
  if (!Number.isFinite(detectedMs)) return false;
  return Date.now() - detectedMs <= FATIGUE_ALERT_CATCH_UP_MS;
}

export function shouldPlayFatigueAlert(
  incident: QueueIncident,
  options: {
    onShift: boolean;
    hasActiveShift: boolean;
    muted: boolean;
    alreadyPlayed?: (lifecycleId: string) => boolean;
  }
): boolean {
  const deskActive = options.onShift || !options.hasActiveShift;
  if (!deskActive || options.muted) return false;
  if (!isTriageAlertMetricType(incident.fatigue_metric_type)) return false;
  if (!isFatigueAlertCatchUpIncident(incident)) return false;
  if (options.alreadyPlayed?.(incident.lifecycle_id)) return false;
  if (playedLifecycleIds.has(incident.lifecycle_id)) return false;
  return true;
}

export function markFatigueAlertsArmed(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ARMED_AT_STORAGE_KEY, String(Date.now()));
}

export function getFatigueAlertsArmedAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(ARMED_AT_STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function isFatigueAlertsArmed(): boolean {
  return getFatigueAlertsArmedAt() > 0;
}

export function isFatigueAlertMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
}

export function setFatigueAlertMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
}

export function isFatigueAlertAudioUnlocked(): boolean {
  return audioContext?.state === "running";
}

function getAlarmAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!alarmAudio) {
    alarmAudio = new Audio(COMMAND_ALARM_SOUND_URL);
    alarmAudio.preload = "auto";
    alarmAudio.setAttribute("playsinline", "");
  }
  return alarmAudio;
}

/** Call from a user gesture (login, enable-sounds button). */
export async function unlockFatigueAlertAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return false;

  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const el = getAlarmAudioElement();
  if (el) {
    try {
      el.muted = true;
      el.currentTime = 0;
      await el.play();
      el.pause();
      el.muted = false;
      el.currentTime = 0;
    } catch {
      // iOS may still block until a visible play(); Web Audio unlock above is enough on desktop.
    }
  }

  return audioContext.state === "running";
}

function scheduleBeep(ctx: AudioContext, startTime: number, frequencyHz: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.85, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.05);
}

/** Spec fallback: 850 Hz square @ 120 BPM when the WAV asset cannot play. */
export function playFatigueAlarmTone(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const beatSec = 60 / 120;
  for (let i = 0; i < 5; i++) {
    scheduleBeep(ctx, t + i * beatSec, 850, 0.18);
  }
}

/** Play the bundled native alarm clip (preferred) with Web Audio fallback. */
export async function playCommandAlarmSound(): Promise<void> {
  const el = getAlarmAudioElement();
  if (el) {
    try {
      el.currentTime = 0;
      el.volume = 1;
      await el.play();
      return;
    } catch {
      // fall through to Web Audio
    }
  }

  if (audioContext?.state === "running") {
    playFatigueAlarmTone(audioContext);
  }
}

/** Audible confirmation after the operator enables sounds. */
export async function playFatigueAlertTestSound(): Promise<boolean> {
  const unlocked = await unlockFatigueAlertAudio();
  if (!unlocked) return false;
  markFatigueAlertsArmed();
  await playCommandAlarmSound();
  return true;
}

export async function resumeFatigueAlertAudio(): Promise<boolean> {
  if (!audioContext) return isFatigueAlertsArmed();
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return false;
    }
  }
  return audioContext.state === "running";
}

export async function maybePlayFatigueAlert(
  incident: QueueIncident,
  options: {
    onShift: boolean;
    hasActiveShift: boolean;
    muted: boolean;
  }
): Promise<boolean> {
  if (!shouldPlayFatigueAlert(incident, options)) return false;
  if (!isFatigueAlertsArmed()) return false;

  await resumeFatigueAlertAudio();
  const unlocked = await unlockFatigueAlertAudio();
  if (!unlocked) return false;

  playedLifecycleIds.add(incident.lifecycle_id);
  await playCommandAlarmSound();
  return true;
}

/** Test helper */
export function resetFatigueAlertAudioForTests(): void {
  playedLifecycleIds.clear();
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
  alarmAudio = null;
}
