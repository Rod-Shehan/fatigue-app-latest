/**
 * EWD / Enterprise / Helper home-screen install.
 *
 * Staff desk is a separate Circadia-only function. This module must never
 * import desk chrome, desk SW, or staff-desk hosts into the product path.
 */

import {
  DEVICE_INSTALL_HELP_LABEL,
  ENTERPRISE_INSTALL_BUTTON_LABEL,
  EWD_INSTALL_BUTTON_LABEL,
  HELPER_INSTALL_BUTTON_LABEL,
} from "@/lib/product-copy";

export type ProductInstallSurface = "ewd" | "enterprise" | "legacy";

export type ProductBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type ProductInstallOutcome = "accepted" | "dismissed" | "unavailable";

function hostnameFromHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.split(":")[0].trim().toLowerCase();
}

/** Staff-desk hosts only — used to keep this listener off the Circadia path. */
export function isStaffDeskInstallHost(host: string | null | undefined): boolean {
  const hostname = hostnameFromHost(host);
  return (
    hostname === "staff-desk" ||
    hostname.startsWith("staff-desk.") ||
    hostname === "admin" ||
    hostname.startsWith("admin.")
  );
}

export function shouldAttachProductInstallListener(opts: {
  hostname: string;
  pathname: string;
}): boolean {
  const pathname = opts.pathname || "/";
  if (pathname === "/circadia" || pathname.startsWith("/circadia/")) return false;
  return !isStaffDeskInstallHost(opts.hostname);
}

export function productInstallSurfaceFromHost(
  host: string | null | undefined
): ProductInstallSurface | null {
  if (isStaffDeskInstallHost(host)) return null;
  const hostname = hostnameFromHost(host);
  if (!hostname) return null;
  if (hostname === "ewd" || hostname.startsWith("ewd.")) return "ewd";
  if (hostname === "enterprise" || hostname.startsWith("enterprise.")) return "enterprise";
  return "legacy";
}

export function productInstallButtonLabel(surface: ProductInstallSurface): string {
  if (surface === "ewd") return EWD_INSTALL_BUTTON_LABEL;
  if (surface === "enterprise") return ENTERPRISE_INSTALL_BUTTON_LABEL;
  return HELPER_INSTALL_BUTTON_LABEL;
}

export function productInstallHelpLabel(): string {
  return DEVICE_INSTALL_HELP_LABEL;
}

let deferred: ProductBeforeInstallPromptEvent | null = null;
let attached = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function hasDeferredProductInstallPrompt(): boolean {
  return deferred != null;
}

export function subscribeProductInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function attachProductPwaInstallListener(): void {
  if (typeof window === "undefined" || attached) return;
  if (
    !shouldAttachProductInstallListener({
      hostname: window.location.hostname,
      pathname: window.location.pathname,
    })
  ) {
    return;
  }
  attached = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as ProductBeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export async function promptProductInstall(): Promise<ProductInstallOutcome> {
  const event = deferred;
  if (!event) return "unavailable";
  deferred = null;
  notify();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}
