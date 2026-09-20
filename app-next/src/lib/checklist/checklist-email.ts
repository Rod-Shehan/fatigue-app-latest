/**
 * Fleet checklist PDF pack delivery.
 * Enterprise Owner console sets pack email + two spares on SystemPolicy.
 * One PDF = one signed log. Date on the file is week ending.
 * Types not merged. Fatigue roadside PDF is never included.
 */

import { isValidMaintenanceEmail } from "@/lib/maintenance-contact";
import type { SystemPolicySnapshot } from "@/lib/system-policy";

export const CHECKLIST_EMAIL_BUTTON_LABEL = "Email checklist PDFs";

export const CHECKLIST_EMAIL_SETTINGS_LABEL = "Checklist PDF pack emails";

export const CHECKLIST_EMAIL_SETTINGS_HINT =
  "Fleet addresses for Fitness for Work, pre-departure, Load check, Hook up, and Fault report PDF packs. Set on Enterprise (Owner console). One PDF per signed log, dated week ending. Not the 28-day fatigue roadside PDF. Not the workshop fault addresses.";

export const CHECKLIST_EMAIL_MISSING_MESSAGE =
  "Set the checklist PDF pack email on Enterprise (Owner console).";

export type ChecklistPackEmails = {
  email: string | null;
  spareEmail1: string | null;
  spareEmail2: string | null;
};

export const EMPTY_CHECKLIST_PACK_EMAILS: ChecklistPackEmails = {
  email: null,
  spareEmail1: null,
  spareEmail2: null,
};

export function checklistPackFromPolicy(policy: SystemPolicySnapshot): ChecklistPackEmails {
  return {
    email: policy.checklistPackEmail,
    spareEmail1: policy.checklistPackSpareEmail1,
    spareEmail2: policy.checklistPackSpareEmail2,
  };
}

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

export function checklistPackRecipientEmails(pack: ChecklistPackEmails): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [pack.email, pack.spareEmail1, pack.spareEmail2]) {
    const email = raw?.trim().toLowerCase();
    if (!email || !isValidMaintenanceEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

export function resolveChecklistPackTo(
  pack: ChecklistPackEmails
): { to: string[] } | { error: string } {
  const to = checklistPackRecipientEmails(pack);
  if (!to.length) return { error: CHECKLIST_EMAIL_MISSING_MESSAGE };
  return { to };
}

export function formatChecklistPackToLabel(to: string | string[]): string {
  const list = Array.isArray(to) ? to : [to];
  return list.map((e) => e.trim()).filter(Boolean).join(", ");
}

/** @deprecated Per-user pack address — org pack on Enterprise is the source of truth. */
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

export function normalizeChecklistPackPatch(
  body: Record<string, unknown>
): Partial<{
  checklistPackEmail: string | null;
  checklistPackSpareEmail1: string | null;
  checklistPackSpareEmail2: string | null;
}> | { error: string } {
  const out: Record<string, string | null> = {};
  const keys = ["checklistPackEmail", "checklistPackSpareEmail1", "checklistPackSpareEmail2"] as const;
  const labels: Record<(typeof keys)[number], string> = {
    checklistPackEmail: "Pack email",
    checklistPackSpareEmail1: "Spare email 1",
    checklistPackSpareEmail2: "Spare email 2",
  };

  for (const key of keys) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null) {
      out[key] = null;
      continue;
    }
    if (typeof v !== "string") {
      return { error: `${key} must be a string or null` };
    }
    const trimmed = v.trim();
    out[key] = trimmed.length ? trimmed : null;
  }

  for (const key of keys) {
    if (out[key] && !isValidMaintenanceEmail(out[key]!)) {
      return { error: `${labels[key]} is not a valid email address` };
    }
  }

  return out;
}
