/**
 * Demo delivery: each signed-in user sets where checklist PDFs go.
 * Stored on User.checklistDeliveryEmail. Empty = that user’s login email.
 * Later: hide this for clients that should use an org inbox instead.
 *
 * Packing: one PDF = one checklist type for one driver week. Types not merged.
 * Fatigue roadside PDF is never included.
 */

import { isValidMaintenanceEmail } from "@/lib/maintenance-contact";

export const CHECKLIST_EMAIL_BUTTON_LABEL = "Email checklist week packs";

export const CHECKLIST_EMAIL_SETTINGS_LABEL = "Checklist PDF email";

export const CHECKLIST_EMAIL_SETTINGS_HINT =
  "Your address for Fitness for Work, Prestart, and Dimension & Load week packs. Defaults to your sign-in email. Each person sets their own. Separate PDF per type. Not the 28-day fatigue roadside PDF. Not the workshop fault address.";

export const CHECKLIST_EMAIL_MISSING_MESSAGE =
  "Set the checklist PDF email in Settings, or add a sign-in email.";

export function normalizeChecklistDeliveryEmail(raw: unknown): { email: string | null } | { error: string } {
  if (raw == null || raw === "") return { email: null };
  if (typeof raw !== "string") return { error: "email must be a string" };
  const email = raw.trim();
  if (!email) return { email: null };
  if (!isValidMaintenanceEmail(email)) return { error: "Not a valid email address" };
  return { email };
}

export function checklistDeliveryEmailReady(email: string | null | undefined): boolean {
  return Boolean(email?.trim() && isValidMaintenanceEmail(email.trim()));
}

/** Saved override if valid, otherwise login email if valid. */
export function resolveChecklistDeliveryTo(opts: {
  checklistDeliveryEmail?: string | null;
  loginEmail?: string | null;
}): { to: string } | { error: string } {
  const override = normalizeChecklistDeliveryEmail(opts.checklistDeliveryEmail ?? "");
  if (!("error" in override) && override.email) return { to: override.email };
  const login = normalizeChecklistDeliveryEmail(opts.loginEmail ?? "");
  if (!("error" in login) && login.email) return { to: login.email };
  return { error: CHECKLIST_EMAIL_MISSING_MESSAGE };
}
