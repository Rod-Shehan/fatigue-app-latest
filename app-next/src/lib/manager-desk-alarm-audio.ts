import type { CameraAlertItem } from "@/lib/api";

const MUTE_STORAGE_KEY = "manager:deskAlertMuted";
const ARMED_AT_STORAGE_KEY = "manager:deskAlertArmedAt";
/** Poll catch-up: only ring if the alert is this recent. */
export const MANAGER_DESK_ALERT_CATCH_UP_MS = 90_000;

export const MANAGER_DESK_ALARM_SOUND_URL = "/sounds/manager-desk-alarm.wav";

const playedAlertIds = new Set<string>();

let audioContext: AudioContext | null = null;
let alarmAudio: HTMLAudioElement | null = null;

export function isManagerDeskAlertCatchUp(alert: Pick<CameraAlertItem, "receivedAt" | "triggerAt">): boolean {
  const iso = alert.triggerAt ?? alert.receivedAt;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= MANAGER_DESK_ALERT_CATCH_UP_MS;
}

export function shouldPlayManagerDeskAlert(
  alert: CameraAlertItem,
  options: {
    onShift: boolean;
    hasActiveShift: boolean;
    muted: boolean;
  }
): boolean {
  const deskActive = options.onShift || !options.hasActiveShift;
  if (!deskActive || options.muted) return false;
  if (!alert.accepted || alert.triageStatus !== "pending") return false;
  if (!isManagerDeskAlertCatchUp(alert)) return false;
  if (playedAlertIds.has(alert.id)) return false;
  return true;
}

export function markManagerDeskAlertsArmed(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ARMED_AT_STORAGE_KEY, String(Date.now()));
}

export function getManagerDeskAlertsArmedAt(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(ARMED_AT_STORAGE_KEY);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function isManagerDeskAlertsArmed(): boolean {
  return getManagerDeskAlertsArmedAt() > 0;
}

export function isManagerDeskAlertMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
}

export function setManagerDeskAlertMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
}

export function isManagerDeskAlertAudioUnlocked(): boolean {
  return audioContext?.state === "running";
}

function getAlarmAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!alarmAudio) {
    alarmAudio = new Audio(MANAGER_DESK_ALARM_SOUND_URL);
    alarmAudio.preload = "auto";
    alarmAudio.playsInline = true;
    alarmAudio.setAttribute("playsinline", "");
  }
  return alarmAudio;
}

export async function unlockManagerDeskAlertAudio(): Promise<boolean> {
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
    } catch {
      // ignore — Web Audio unlock is enough on desktop
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

function playDeskAlarmTone(ctx: AudioContext): void {
  const t = ctx.currentTime;
  const beatSec = 60 / 120;
  for (let i = 0; i < 5; i++) {
    scheduleBeep(ctx, t + i * beatSec, 850, 0.18);
  }
}

export async function playManagerDeskAlarmSound(): Promise<void> {
  const el = getAlarmAudioElement();
  if (el) {
    try {
      el.currentTime = 0;
      el.volume = 1;
      await el.play();
      return;
    } catch {
      // fall through
    }
  }
  if (audioContext?.state === "running") {
    playDeskAlarmTone(audioContext);
  }
}

export async function playManagerDeskAlertTestSound(): Promise<boolean> {
  const unlocked = await unlockManagerDeskAlertAudio();
  if (!unlocked) return false;
  markManagerDeskAlertsArmed();
  await playManagerDeskAlarmSound();
  return true;
}

export async function resumeManagerDeskAlertAudio(): Promise<boolean> {
  if (!audioContext) return isManagerDeskAlertsArmed();
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return false;
    }
  }
  return audioContext.state === "running";
}

export async function maybePlayManagerDeskAlert(
  alert: CameraAlertItem,
  options: {
    onShift: boolean;
    hasActiveShift: boolean;
    muted: boolean;
  }
): Promise<boolean> {
  if (!shouldPlayManagerDeskAlert(alert, options)) return false;
  if (!isManagerDeskAlertsArmed()) return false;

  await resumeManagerDeskAlertAudio();
  const unlocked = await unlockManagerDeskAlertAudio();
  if (!unlocked) return false;

  playedAlertIds.add(alert.id);
  await playManagerDeskAlarmSound();
  return true;
}

export function resetManagerDeskAlertAudioForTests(): void {
  playedAlertIds.clear();
  if (audioContext) {
    void audioContext.close();
    audioContext = null;
  }
  alarmAudio = null;
}
