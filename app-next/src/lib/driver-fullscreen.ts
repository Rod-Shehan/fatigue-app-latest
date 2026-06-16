import { isStandaloneDisplay } from "@/lib/device-setup";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

/** True when browser chrome is hidden (installed PWA or Fullscreen API). */
export function isImmersiveDriverDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplay()) return true;
  if (window.matchMedia?.("(display-mode: fullscreen)")?.matches) return true;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** Enter fullscreen when still in a browser tab (requires a user gesture). */
export async function requestDriverImmersive(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  if (isImmersiveDriverDisplay()) return true;

  const el = document.documentElement as FullscreenElement;
  try {
    if (typeof el.requestFullscreen === "function") {
      await el.requestFullscreen();
      return isImmersiveDriverDisplay();
    }
    if (typeof el.webkitRequestFullscreen === "function") {
      await el.webkitRequestFullscreen();
      return isImmersiveDriverDisplay();
    }
  } catch {
    /* denied or unsupported — stay in browser tab */
  }
  return false;
}

export function syncDriverImmersiveClass(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("driver-immersive", isImmersiveDriverDisplay());
}
