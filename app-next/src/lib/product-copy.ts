/**
 * Product narrative: rolling time, weekly record slices, non-work as default.
 * Used for disclaimers and driver-facing copy (not legal advice).
 */

import { COMPLIANCE_PRIOR_WEEKS_LOOKBACK } from "@/lib/compliance-history";
import { RECORD_RETENTION_YEARS } from "@/lib/record-retention";

/**
 * Canonical record contract (prevention/education + evidence).
 * Implementation should enforce: unsigned weeks editable for drivers until attestation;
 * signed weeks locked; manager amendments use reason + audit trail.
 */
export const SHEET_RECORD_CONTRACT =
  "While a week is unsigned, you can correct any day on that record. After you sign, it is locked — your manager can amend with a reason on file, then you re-sign if needed.";

/** Design intent behind {@link SHEET_RECORD_CONTRACT} — not shown verbatim to drivers. */
export const SHEET_RECORD_CONTRACT_NOTES = [
  "Drivers cannot rewrite history; they review, sign, and act in the present week.",
  "Incorrect past data is corrected through manager amendment (reason required), not silent edits — avoiding both tampering and unfixable wrong records.",
  "The legal record is the named driver's attestation (signature), not the manager's edit — manager changes always return to the driver to sign.",
  "Rolling compliance may read up to prior weeks for calculations; that is not the same as editing or operating on a past sheet.",
  `Rule checks load about ${COMPLIANCE_PRIOR_WEEKS_LOOKBACK} prior weeks for 14–28 day limits. Signed records must be kept for at least ${RECORD_RETENTION_YEARS} years (WA Reg 184G; HVNL s 341).`,
] as const;

/**
 * Attestation workflow (driver vs manager) — implement before tightening past-week PATCH rules.
 *
 * Axes (orthogonal):
 * - **Week epoch**: current regulatory week (actionable) vs past week (archive for drivers).
 * - **Content lock**: driver cannot edit past-week facts; manager may amend with reason + audit.
 * - **Attestation**: signature + signed_at = driver attests this slice is their record.
 *
 * Paths:
 * 1. Past week, never signed → driver may edit days and sign; manager may amend → driver signs → locked.
 * 2. Past week, signed → manager amends (reason) → signature cleared, pending driver re-sign → driver signs → locked.
 * 3. Current week → driver logs (live bar on today only); may edit any unsigned day; sign only after the week ends (past week); re-sign after manager amend.
 *
 * Manager edit policy (real world / ISO 9001–style document control):
 * - Driver and manager may negotiate corrections over multiple edits; each edit is audited with reason.
 * - The record is not legally attested until the driver signs the version they agree with.
 * - Edit count is not a compliance metric — only that the final signed output truthfully represents what happened.
 * - When ready, manager tells the driver to open the week and sign; until then the sheet stays unsigned (or re-sign pending).
 *
 * Do NOT treat manager amendment as completion. Do NOT auto-close past weeks as "completed" without signature
 * if the driver is expected to attest — use pending attestation instead.
 */
export const SHEET_ATTESTATION_WORKFLOW = {
  /** Driver-facing: sheet was corrected; your signature is required again. */
  RESIGN_AFTER_AMENDMENT_TITLE: "Your manager corrected this record",
  RESIGN_AFTER_AMENDMENT_BODY:
    "Review the week below. If it is correct, sign again — your signature is the legal record, not the manager's edit.",
  /** Manager-facing: when corrections are agreed — send for driver attestation. */
  MANAGER_SEND_FOR_DRIVER_SIGN:
    "When you and the driver agree the week is correct, ask them to open it from Your Sheets and sign. Until they sign, this is not their attested record.",
  /** Manager-facing: further edits allowed before driver sign (document control). */
  MANAGER_AMEND_UNTIL_AGREED:
    "You can amend as many times as needed while you align with the driver. Each change needs a reason and is audited. Clear the path to sign only when the content is right.",
} as const;

/** One paragraph: what the app is for. */
export const PRODUCT_RECORD_PROMISE =
  "Circadia keeps a weekly fatigue record automatically. Time is classified as work, break, or non-work; " +
  "if you do not log work or a break, the rest of that period is non-work—like blank days on a paper work diary. " +
  "Each week is a slice of that timeline for you to review and sign when required.";

/** Short line under major headings (e.g. Your Sheets). */
export const SHEETS_LIST_TAGLINE =
  "Your weekly record exists for compliance whether or not you logged a shift—non-work still counts.";

/** Driver help: records, archives, and signing (plain language). */
export const DRIVER_HELP_RECORDS_SIGNING_BULLETS = [
  "The app opens on this week — use Work, Break, and End shift on today while the week is unsigned.",
  "Past weeks that are still unsigned: open the week, expand a day, and fix route or times before you sign.",
  "Your signature means you attest that week is your record. It is not the manager's signature.",
  "Sign a week only after it has ended (from the following Sunday) — not while you are still logging that week.",
  "After you sign, that week is locked. If something is wrong, your manager amends (with a reason on file); you review and sign again.",
  "Unsigned past weeks show as reminders — they do not block logging on the current week.",
] as const;

/** Bullets: how weeks appear to the driver in the UI. */
export const USER_VISIBLE_SHEET_STATE_BULLETS = [
  "Current regulatory week — log Work/Break/End shift on today; edit any day until the week ends; sign from the following Sunday.",
  "Unsigned past weeks — expand a day to fix route or times, then sign when correct.",
  "Signed weeks — locked for you; manager edits need your signature again.",
] as const;

/** Manager UI: why past-week edit exists (amendment flow). */
export const MANAGER_PAST_WEEK_AMEND_HINT =
  "Past weeks are sealed for drivers. Amend only to fix a genuine error, with a clear reason — every change is audited.";

/** Opening / first-run style disclaimer (can be shown once or always in compact form). */
export const OPENING_DISCLAIMER_COMPACT =
  "No log does not mean no record: unlogged time in the diary is treated as non-work for display and rolling checks, unless events show otherwise.";

/** Help page: unsigned past weeks are reminders only. */
export const UNSIGNED_WEEKS_GATE_HINT =
  "Unsigned past weeks show as reminders with links to sign. They do not block Start shift or logging on the current week.";

/** Soft reminder on drive home / current week sheet (does not block shift start). */
export function formatUnsignedPastWeeksReminderMessage(count: number): string {
  if (count <= 0) return "";
  return count === 1
    ? "1 past week still needs your signature. You can keep logging this week — sign when you have a moment."
    : `${count} past weeks still need your signature. You can keep logging this week — sign when you have a moment.`;
}

/** Banner when signing a past (archived) week — weekOfLabel e.g. "22 Mar 2026". */
export function formatSignPastWeekTitle(weekOfLabel: string): string {
  return `Sign week of ${weekOfLabel}`;
}

export function formatSignPastWeekBody(weekOfLabel: string): string {
  return (
    `Week of ${weekOfLabel} is not your current logging week. Expand any day below to fix route or times, then sign. ` +
    `To log work live now, use Drive home → Log more work.`
  );
}

export function formatResignPastWeekTitle(weekOfLabel: string): string {
  return `Re-sign week of ${weekOfLabel}`;
}

export function formatResignPastWeekBody(weekOfLabel: string): string {
  return (
    `Your manager corrected the week of ${weekOfLabel}. Review it below. If it is correct, sign again — ` +
    `your signature is the legal record. This is not your current logging week.`
  );
}

export const SIGN_CURRENT_WEEK_TITLE = "Sign this week's record";
export const SIGN_CURRENT_WEEK_BODY =
  "Review this week below. When it is correct, sign to confirm the record is yours.";

/** Driver tried to sign before the regulatory week ended. */
export const DRIVER_SIGN_WEEK_NOT_ENDED_ERROR =
  "You can only sign a week after it has ended (from the following Sunday). Keep logging on this week until then.";

/** Shown on the in-progress current week instead of a Sign button. */
export const CURRENT_WEEK_SIGN_UNAVAILABLE_HINT =
  "Sign unlocks after this week ends — from the following Sunday. Use Start shift and Set up day while the week is open.";

/** Sunday current-week card — open prior week Saturday Edit day across the week seam (pre-sign fix). */
export const EDIT_PREVIOUS_WEEK_BUTTON_LABEL = "Edit previous week";
export const EDIT_PREVIOUS_WEEK_BUTTON_TITLE =
  "Fix last week's final shift before you sign — opens Saturday Edit day";

/** Deep-link to open Edit day on a sheet day (Saturday = 6). */
export function sheetEditDayHref(sheetId: string, dayIndex: number): string {
  const idx = Math.max(0, Math.min(6, Math.floor(dayIndex)));
  return `/sheets/${sheetId}?editDay=${idx}#fatigue-day-${idx}`;
}

export const ROUTE_CATALOGUE_EMPTY_HINT =
  "No saved run plans yet. Use Enter run plan to enter today's route, or ask your manager to add fleet routes in the route catalogue.";

export const ROUTE_CATALOGUE_LOAD_ERROR_HINT =
  "Could not load saved run plans. Use Enter run plan for now — if this persists, your manager may need to update the database schema.";

export function formatPastWeekArchiveSubtitle(weekOfLabel: string): string {
  return `Archive · week of ${weekOfLabel}`;
}

/** Signed past week — informational banner (not a compliance warning). */
export function formatPastWeekArchiveBannerTitle(weekOfLabel: string): string {
  return `Past record · week of ${weekOfLabel}`;
}

export function formatPastWeekArchiveBannerBody(): string {
  return (
    "Signed and locked — this is your legal record for that week. Review or export below. " +
    "Ask your manager only if something needs correcting."
  );
}

/** Signed current week — locked, no edits. */
export const SIGNED_CURRENT_WEEK_ARCHIVE_TITLE = "Signed week — locked record";
export const SIGNED_CURRENT_WEEK_ARCHIVE_BODY =
  "This week is signed and locked. Review or export here; ask your manager to amend if something needs correcting.";

/** When driver cannot sign until validation passes (e.g. missing kms). */
export function formatSignBlockedPastWeekMessage(validationError: string, weekOfLabel: string): string {
  void weekOfLabel;
  return validationError;
}

/** Open work/break continues across the calendar-day card — confirm route on this day's record. */
export function formatContinuedShiftRouteBanner(previousDayName: string): string {
  return `Your shift is still open from ${previousDayName}. Confirm today's route details for this day's record — End shift when you finish.`;
}

export const CONTINUED_SHIFT_ROUTE_CARD_NOTE =
  "Suggested from your open shift — Confirm in Set up day to save on this day's record (and the timesheet/PDF).";
