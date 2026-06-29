import type { QueueIncident } from "@/hooks/use-triage-queue";

const MUTE_STORAGE_KEY = "command:fatigueAlertMuted";
/** SSE reconnect catch-up: only ring if the event is this recent. */
export const FATIGUE_ALERT_CATCH_UP_MS = 90_000;

const playedLifecycleIds = new Set<string>();

let audioContext: AudioContext | null = null;

export function isFatigueMetricType(fatigueMetricType: string | null | undefined): boolean {
  const normalized = String(fatigueMetricType ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return normalized === "FATIGUE";
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
    muted: boolean;
    audioUnlocked: boolean;
    alreadyPlayed?: (lifecycleId: string) => boolean;
  }
): boolean {
  if (!options.onShift || options.muted || !options.audioUnlocked) return false;
  if (!isFatigueMetricType(incident.fatigue_metric_type)) return false;
  if (!isFatigueAlertCatchUpIncident(incident)) return false;
  if (options.alreadyPlayed?.(incident.lifecycle_id)) return false;
  if (playedLifecycleIds.has(incident.lifecycle_id)) return false;
  return true;
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

/** Call from a user gesture (login, enable-sounds button). */
export async function unlockFatigueAlertAudio(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return false;

  if (!audioContext) audioContext = new Ctx();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext.state === "running";
}

function scheduleBeep(ctx: AudioContext, startTime: number, frequencyHz: number, durationSec: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.05);
}

/** Urgent desk alarm: rapid double-chime escalation (Web Audio — no asset file). */
export function playFatigueAlarmTone(ctx: AudioContext): void {
  const t = ctx.currentTime;
  scheduleBeep(ctx, t, 880, 0.14);
  scheduleBeep(ctx, t + 0.22, 880, 0.14);
  scheduleBeep(ctx, t + 0.5, 1175, 0.22);
  scheduleBeep(ctx, t + 0.82, 1175, 0.28);
}

export async function maybePlayFatigueAlert(
  incident: QueueIncident,
  options: {
    onShift: boolean;
    muted: boolean;
    audioUnlocked: boolean;
  }
): Promise<boolean> {
  if (!shouldPlayFatigueAlert(incident, options)) return false;

  const unlocked = options.audioUnlocked || (await unlockFatigueAlertAudio());
  if (!unlocked || !audioContext) return false;

  playedLifecycleIds.add(incident.lifecycle_id);
  playFatigueAlarmTone(audioContext);
  return true;
}

/** Test helper */
export function resetFatigueAlertAudioForTests(): void {
  playedLifecycleIds.clear();
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
}
