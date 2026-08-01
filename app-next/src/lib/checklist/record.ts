/**
 * Completed checklist records embedded in day JSON (Phase 2).
 * No Prisma model — same FatigueSheet.days persistence as other day fields.
 */

import type {
  ChecklistAcknowledgeValue,
  ChecklistDefect,
  ChecklistItemValue,
  ChecklistSignatureCapture,
} from "./item-types";
import { isAcknowledgeItemComplete, isPassFailItemComplete } from "./item-state";
import type { ChecklistPassFailItemState, ChecklistAcknowledgeItemState } from "./item-types";

export const CHECKLIST_SCHEMA_VERSION = 1;

export type ChecklistRecordType = "ffw" | "prestart" | "dimension_load";

export type ChecklistLoaderPath =
  | "present"
  | "pending"
  | "not_obtained"
  | "self_as_loader";

export type ChecklistRecordItem =
  | {
      code: string;
      label?: string;
      kind: "pass_fail";
      value: ChecklistItemValue;
      defect?: ChecklistDefect | null;
    }
  | {
      code: string;
      label?: string;
      kind: "acknowledge";
      value: ChecklistAcknowledgeValue;
    };

export type ChecklistRecordSignature = ChecklistSignatureCapture & {
  role: "driver" | "loader";
};

export type ChecklistRecord = {
  id: string;
  type: ChecklistRecordType;
  schemaVersion: number;
  status: "completed";
  completedAtUtc: string;
  items: ChecklistRecordItem[];
  signatures: ChecklistRecordSignature[];
  /** Phase 4+ — optional on early records */
  prestartResponsible?: boolean;
  prestartSkipReason?: string | null;
  /**
   * Prestart fault report text for workshop / WAHVA maintenance email
   * (above signature when any group is Fault).
   */
  actionedFaultText?: string | null;
  /** Phase 5+ — optional on early records */
  loaderPath?: ChecklistLoaderPath | null;
  loaderName?: string | null;
  header?: Record<string, string | number | null | undefined>;
  /** Mode C evidence photos (loader CoR not obtained) */
  evidencePhotoDataUrls?: string[];
};

/** ~350KB raw → keep data URLs bounded for sheet JSON / IndexedDB. */
export const CHECKLIST_MAX_PHOTO_DATA_URL_CHARS = 350_000;
export const CHECKLIST_MAX_SIGNATURE_DATA_URL_CHARS = 200_000;
export const CHECKLIST_MAX_PHOTOS_PER_DEFECT = 4;
export const CHECKLIST_MAX_EVIDENCE_PHOTOS = 6;

export function newChecklistRecordId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isChecklistRecordType(v: unknown): v is ChecklistRecordType {
  return v === "ffw" || v === "prestart" || v === "dimension_load";
}

export function dataUrlWithinLimit(dataUrl: string, maxChars: number): boolean {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:") && dataUrl.length <= maxChars;
}

function itemComplete(item: ChecklistRecordItem): boolean {
  if (item.kind === "acknowledge") {
    return isAcknowledgeItemComplete({ value: item.value } as ChecklistAcknowledgeItemState);
  }
  const state: ChecklistPassFailItemState = {
    value: item.value,
    defect: item.defect ?? null,
  };
  return isPassFailItemComplete(state);
}

export type ChecklistValidationError = { code: string; message: string };

/**
 * Validate a completed record before persist.
 * Does not invent loader CoR acknowledgment (proxy forbidden).
 */
export function validateCompletedChecklistRecord(
  raw: unknown
): { ok: true; record: ChecklistRecord } | { ok: false; errors: ChecklistValidationError[] } {
  const errors: ChecklistValidationError[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: [{ code: "invalid", message: "Record must be an object" }] };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== "string" || !r.id.trim()) {
    errors.push({ code: "id", message: "id is required" });
  }
  if (!isChecklistRecordType(r.type)) {
    errors.push({ code: "type", message: "type must be ffw | prestart | dimension_load" });
  }
  if (r.status !== "completed") {
    errors.push({ code: "status", message: "Only completed records can be persisted in Phase 2" });
  }
  if (typeof r.completedAtUtc !== "string" || !r.completedAtUtc.trim()) {
    errors.push({ code: "completedAtUtc", message: "completedAtUtc is required" });
  }
  const prestartNotResponsible =
    r.type === "prestart" && r.prestartResponsible === false;
  if (prestartNotResponsible) {
    if (typeof r.prestartSkipReason !== "string" || !String(r.prestartSkipReason).trim()) {
      errors.push({
        code: "prestartSkipReason",
        message: "prestartSkipReason is required when not responsible for prestart",
      });
    }
    // Empty items allowed — do not invent Pass/Fail answers for another driver's duty.
    if (Array.isArray(r.items) && r.items.length > 0) {
      errors.push({
        code: "items",
        message: "Not-responsible prestart must not include inspection item answers",
      });
    }
  } else if (!Array.isArray(r.items) || r.items.length === 0) {
    errors.push({ code: "items", message: "items must be a non-empty array" });
  } else {
    for (const item of r.items as ChecklistRecordItem[]) {
      if (!item || typeof item !== "object" || !item.code) {
        errors.push({ code: "items", message: "Each item needs a code" });
        break;
      }
      if (!itemComplete(item)) {
        errors.push({
          code: "items",
          message: `Item ${item.code} is incomplete (Fail needs defect text; acknowledge must be checked)`,
        });
      }
      if (item.kind === "pass_fail" && item.value === "fail" && item.defect) {
        const photos = item.defect.photoDataUrls ?? [];
        if (photos.length > CHECKLIST_MAX_PHOTOS_PER_DEFECT) {
          errors.push({ code: "photos", message: `Too many defect photos on ${item.code}` });
        }
        for (const p of photos) {
          if (!dataUrlWithinLimit(p, CHECKLIST_MAX_PHOTO_DATA_URL_CHARS)) {
            errors.push({ code: "photos", message: `Defect photo too large or invalid on ${item.code}` });
          }
        }
      }
    }
  }

  if (!Array.isArray(r.signatures) || r.signatures.length === 0) {
    errors.push({ code: "signatures", message: "At least one signature is required" });
  } else {
    const sigs = r.signatures as ChecklistRecordSignature[];
    const hasDriver = sigs.some((s) => s?.role === "driver");
    if (!hasDriver) {
      errors.push({ code: "signatures", message: "Driver signature is required" });
    }
    for (const s of sigs) {
      if (!s?.pngDataUrl || !dataUrlWithinLimit(s.pngDataUrl, CHECKLIST_MAX_SIGNATURE_DATA_URL_CHARS)) {
        errors.push({ code: "signatures", message: "Signature PNG missing or too large" });
        break;
      }
      if (s.role === "loader") {
        const path = r.loaderPath;
        if (path !== "present" && path !== "self_as_loader") {
          errors.push({
            code: "loader",
            message: "Loader signature only allowed when loader is present or self-as-loader (no proxy)",
          });
        }
      }
    }
  }

  if (Array.isArray(r.evidencePhotoDataUrls)) {
    const ev = r.evidencePhotoDataUrls as string[];
    if (ev.length > CHECKLIST_MAX_EVIDENCE_PHOTOS) {
      errors.push({ code: "evidence", message: "Too many evidence photos" });
    }
    for (const p of ev) {
      if (!dataUrlWithinLimit(p, CHECKLIST_MAX_PHOTO_DATA_URL_CHARS)) {
        errors.push({ code: "evidence", message: "Evidence photo too large or invalid" });
        break;
      }
    }
  }

  if (r.type === "dimension_load") {
    const path = r.loaderPath;
    if (
      path !== "present" &&
      path !== "pending" &&
      path !== "not_obtained" &&
      path !== "self_as_loader"
    ) {
      errors.push({
        code: "loaderPath",
        message: "dimension_load requires loaderPath (present | pending | not_obtained | self_as_loader)",
      });
    } else {
      const loaderName =
        typeof r.loaderName === "string" ? r.loaderName.trim() : "";
      if ((path === "present" || path === "pending") && !loaderName) {
        errors.push({
          code: "loaderName",
          message: "Loader name is required when the loader is known",
        });
      }
      if (path === "self_as_loader") {
        const sigs = Array.isArray(r.signatures) ? (r.signatures as ChecklistRecordSignature[]) : [];
        if (!sigs.some((s) => s?.role === "loader")) {
          errors.push({
            code: "signatures",
            message: "Self-as-loader requires a separate As loader signature (no merged sign-off)",
          });
        }
      }
      if (path === "present") {
        const sigs = Array.isArray(r.signatures) ? (r.signatures as ChecklistRecordSignature[]) : [];
        if (!sigs.some((s) => s?.role === "loader")) {
          errors.push({
            code: "signatures",
            message: "Loader signature is required when the loader is present",
          });
        }
      }
    }
  }

  if (r.loaderPath === "not_obtained") {
    const ev = (r.evidencePhotoDataUrls as string[] | undefined) ?? [];
    if (ev.length < 1) {
      errors.push({
        code: "evidence",
        message: "Photo evidence required when loader CoR is not obtained",
      });
    }
  }

  if (r.type === "prestart" && r.prestartResponsible !== false && Array.isArray(r.items)) {
    const hasFault = (r.items as ChecklistRecordItem[]).some(
      (item) => item?.kind === "pass_fail" && item.value === "fail"
    );
    if (hasFault) {
      const text =
        typeof r.actionedFaultText === "string" ? r.actionedFaultText.trim() : "";
      if (!text) {
        errors.push({
          code: "actionedFaultText",
          message: "Describe the actioned fault for the workshop email before signing",
        });
      }
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    record: {
      id: String(r.id).trim(),
      type: r.type as ChecklistRecordType,
      schemaVersion: typeof r.schemaVersion === "number" ? r.schemaVersion : CHECKLIST_SCHEMA_VERSION,
      status: "completed",
      completedAtUtc: String(r.completedAtUtc),
      items: Array.isArray(r.items) ? (r.items as ChecklistRecordItem[]) : [],
      signatures: r.signatures as ChecklistRecordSignature[],
      prestartResponsible: typeof r.prestartResponsible === "boolean" ? r.prestartResponsible : undefined,
      prestartSkipReason:
        r.prestartSkipReason == null ? r.prestartSkipReason : String(r.prestartSkipReason),
      actionedFaultText:
        typeof r.actionedFaultText === "string"
          ? r.actionedFaultText.trim() || null
          : r.actionedFaultText == null
            ? null
            : String(r.actionedFaultText),
      loaderPath: (r.loaderPath as ChecklistLoaderPath | null | undefined) ?? null,
      loaderName: r.loaderName == null ? null : String(r.loaderName),
      header: (r.header as ChecklistRecord["header"]) ?? undefined,
      evidencePhotoDataUrls: Array.isArray(r.evidencePhotoDataUrls)
        ? (r.evidencePhotoDataUrls as string[])
        : undefined,
    },
  };
}

export function hasCompletedChecklistOfType(
  checklists: ChecklistRecord[] | null | undefined,
  type: ChecklistRecordType
): boolean {
  if (!Array.isArray(checklists)) return false;
  return checklists.some((c) => c?.status === "completed" && c.type === type);
}

/**
 * Prestart that completed the vehicle inspection (not a “not responsible” skip).
 * Used for trip-sheet Daily vehicle checklist tick (A1).
 */
export function hasCompletedResponsiblePrestart(
  checklists: ChecklistRecord[] | null | undefined
): boolean {
  if (!Array.isArray(checklists)) return false;
  return checklists.some(
    (c) =>
      c?.status === "completed" &&
      c.type === "prestart" &&
      c.prestartResponsible !== false &&
      Array.isArray(c.items) &&
      c.items.length > 0
  );
}

export function listCompletedChecklists(
  checklists: ChecklistRecord[] | null | undefined
): ChecklistRecord[] {
  if (!Array.isArray(checklists)) return [];
  return checklists.filter((c) => c?.status === "completed" && isChecklistRecordType(c.type));
}
