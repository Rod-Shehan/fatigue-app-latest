/**
 * Org-wide maintenance / workshop contact for WAHVA defect reporting.
 * Stored on SystemPolicy; email send path is separate (outbound mailer).
 */

import { getSystemPolicy, type SystemPolicySnapshot } from "@/lib/system-policy";

export type MaintenanceContact = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export const EMPTY_MAINTENANCE_CONTACT: MaintenanceContact = {
  name: null,
  company: null,
  email: null,
  phone: null,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidMaintenanceEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function maintenanceContactFromPolicy(policy: SystemPolicySnapshot): MaintenanceContact {
  return {
    name: policy.maintenanceContactName,
    company: policy.maintenanceContactCompany,
    email: policy.maintenanceContactEmail,
    phone: policy.maintenanceContactPhone,
  };
}

export async function getMaintenanceContact(): Promise<MaintenanceContact> {
  const policy = await getSystemPolicy();
  return maintenanceContactFromPolicy(policy);
}

/** True when a usable report destination email is configured. */
export function maintenanceContactEmailReady(contact: MaintenanceContact): boolean {
  return Boolean(contact.email && isValidMaintenanceEmail(contact.email));
}

/**
 * Client-side fallback / preview — opens the user’s mail client.
 * Server reporting should use sendOutboundEmail instead.
 */
export function buildMaintenanceMailtoHref(input: {
  contact: MaintenanceContact;
  subject: string;
  body: string;
}): string | null {
  const email = input.contact.email?.trim();
  if (!email || !isValidMaintenanceEmail(email)) return null;
  const q = new URLSearchParams();
  if (input.subject.trim()) q.set("subject", input.subject.trim());
  if (input.body.trim()) q.set("body", input.body.trim());
  const qs = q.toString();
  return `mailto:${email}${qs ? `?${qs}` : ""}`;
}

/** Normalize PATCH body fields; empty string → null. */
export function normalizeMaintenanceContactPatch(
  body: Record<string, unknown>
): Partial<{
  maintenanceContactName: string | null;
  maintenanceContactCompany: string | null;
  maintenanceContactEmail: string | null;
  maintenanceContactPhone: string | null;
}> | { error: string } {
  const out: Record<string, string | null> = {};
  const keys = [
    "maintenanceContactName",
    "maintenanceContactCompany",
    "maintenanceContactEmail",
    "maintenanceContactPhone",
  ] as const;

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

  if ("maintenanceContactEmail" in out && out.maintenanceContactEmail) {
    if (!isValidMaintenanceEmail(out.maintenanceContactEmail)) {
      return { error: "maintenanceContactEmail is not a valid email address" };
    }
  }

  return out;
}
