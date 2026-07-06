import type { QueueIncident } from "@/hooks/use-triage-queue";

const MUTE_STORAGE_KEY = "command:fatigueAlertMuted";
const ARMED_AT_STORAGE_KEY = "command:fatigueAlertArmedAt";
/** Optional safety gate for stale catch-up only — not applied to live SSE or new poll IDs. */
export const FATIGUE_ALERT_CATCH_UP_MS = 90_000;

/** Bundled desk alarm (850 Hz square @ 120 BPM, ~2.5 s). */
export const COMMAND_ALARM_SOUND_URL = "/sounds/command-alarm.wav";

export type FatigueAlertRingSource = "sse-live" | "sse-replay" | "poll";

const playedLifecycleIds = new Set<string>();

let audioContext: AudioContext | null = null;
let alarmAudio: HTMLAudioElement | null = null;
let runtimePlayReady = false;
let lastAlarmAt: number | null = null;

type StateListener = () => void;
const stateListeners = new Set<StateListener>();

function notifyStateListeners(): void {
  stateListeners.forEach((listener) => listener());
}

export function subscribeFatigueAlertState(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

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

export function hasPlayedFatigueAlert(lifecycleId: string): boolean {
  return playedLifecycleIds.has(lifecycleId);
}

export function shouldPlayFatigueAlert(
  incident: QueueIncident,
  options: {
    onShift: boolean;
    hasActiveShift: boolean;
    muted: boolean;
    source: FatigueAlertRingSource;
    alreadyPlayed?: (lifecycleId: string) => boolean;
  }
): boolean {
  const deskActive = options.onShift || !options.hasActiveShift;
  if (!deskActive || options.muted) return false;
  if (!isTriageAlertMetricType(incident.fatigue_metric_type)) return false;
  if (options.alreadyPlayed?.(incident.lifecycle_id)) return false;
  if (playedLifecycleIds.has(incident.lifecycle_id)) return false;

  if (options.source === "sse-live" || options.source === "sse-replay" || options.source === "poll") {
    return true;
  }

  return isFatigueAlertCatchUpIncident(incident);
}

function readFatigueAlertsArmedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const legacy = window.sessionStorage.getItem(ARMED_AT_STORAGE_KEY);
    if (legacy) {
      window.localStorage.setItem(ARMED_AT_STORAGE_KEY, legacy);
      window.sessionStorage.removeItem(ARMED_AT_STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
  const raw = window.localStorage.getItem(ARMED_AT_STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function markFatigueAlertsArmed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARMED_AT_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  notifyStateListeners();
}

export function getFatigueAlertsArmedAt(): number {
  return readFatigueAlertsArmedAt();
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
  notifyStateListeners();
}

/** In-memory: browser can play audio right now (not suspended). */
export function isRuntimeAudioUnlocked(): boolean {
  if (runtimePlayReady) return true;
  return audioContext?.state === "running";
}

/** @deprecated Use isRuntimeAudioUnlocked — kept for gradual migration. */
export function isFatigueAlertAudioUnlocked(): boolean {
  return isRuntimeAudioUnlocked();
}

export function needsFatigueAlertRearm(): boolean {
  return isFatigueAlertsArmed() && !isRuntimeAudioUnlocked();
}

export function markRuntimeUnlocked(): void {
  runtimePlayReady = true;
  notifyStateListeners();
}

export function markNeedsRearm(): void {
  runtimePlayReady = false;
  notifyStateListeners();
}

export function getLastAlarmAt(): number | null {
  return lastAlarmAt;
}

function markLastAlarmPlayed(): void {
  lastAlarmAt = Date.now();
  notifyStateListeners();
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
  const Ctx =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
      markRuntimeUnlocked();
      return true;
    } catch {
      // iOS may still block until a visible play(); fall through to Web Audio check.
    }
  }

  const ok = audioContext.state === "running";
  if (ok) markRuntimeUnlocked();
  return ok;
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
export async function playCommandAlarmSound(): Promise<boolean> {
  const el = getAlarmAudioElement();
  if (el) {
    try {
      el.currentTime = 0;
      el.volume = 1;
      await el.play();
      markRuntimeUnlocked();
      return true;
    } catch {
      // fall through to Web Audio
    }
  }

  if (audioContext?.state === "running") {
    playFatigueAlarmTone(audioContext);
    markRuntimeUnlocked();
    return true;
  }

  markNeedsRearm();
  return false;
}

/** Restore audio unlock during a user gesture if this device already opted in. */
export async function rearmFatigueAlertsOnUserGesture(): Promise<boolean> {
  if (!isFatigueAlertsArmed()) return false;
  const unlocked = await unlockFatigueAlertAudio();
  if (unlocked) {
    markFatigueAlertsArmed();
    markRuntimeUnlocked();
  }
  return unlocked;
}

/** Attempt resume without user gesture — may fail on iOS. */
export async function tryResumeFatigueAlertAudio(): Promise<boolean> {
  if (!isFatigueAlertsArmed()) return false;

  if (audioContext?.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      markNeedsRearm();
      return false;
    }
  }

  if (audioContext?.state === "running") {
    markRuntimeUnlocked();
    return true;
  }

  markNeedsRearm();
  return false;
}

/** Audible confirmation after the operator enables sounds. */
export async function playFatigueAlertTestSound(): Promise<boolean> {
  const unlocked = await unlockFatigueAlertAudio();
  if (!unlocked) return false;
  markFatigueAlertsArmed();
  const played = await playCommandAlarmSound();
  if (played) markLastAlarmPlayed();
  return played;
}

export async function resumeFatigueAlertAudio(): Promise<boolean> {
  return tryResumeFatigueAlertAudio();
}

export async function maybePlayFatigueAlert(
  incident: QueueIncident,
  options: {
    onShift: boolean;
    hasActiveShift: boolean;
    muted: boolean;
    source: FatigueAlertRingSource;
  }
): Promise<boolean> {
  if (!shouldPlayFatigueAlert(incident, options)) return false;
  if (!isFatigueAlertsArmed()) return false;

  const resumed = await tryResumeFatigueAlertAudio();
  if (!resumed && !isRuntimeAudioUnlocked()) {
    markNeedsRearm();
    return false;
  }

  playedLifecycleIds.add(incident.lifecycle_id);
  const played = await playCommandAlarmSound();
  if (played) {
    markLastAlarmPlayed();
    return true;
  }

  playedLifecycleIds.delete(incident.lifecycle_id);
  return false;
}

/** Test helper */
export function resetFatigueAlertAudioForTests(): void {
  playedLifecycleIds.clear();
  runtimePlayReady = false;
  lastAlarmAt = null;
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
  alarmAudio = null;
  stateListeners.clear();
}
