/**
 * Product narrative: rolling time, weekly record slices, non-work as default.
 * Used for disclaimers and driver-facing copy (not legal advice).
 */

/**
 * Canonical record contract (prevention/education + evidence).
 * Implementation should enforce: past weeks read-only for drivers; current week actionable;
 * past edits only via authorised manager with mandatory reason + audit trail.
 */
export const SHEET_RECORD_CONTRACT =
  "Any week before the current regulatory week is a read-only archive; only the current week accepts driver actions, while only an authorised manager can edit past records with reasons for doing so.";

/** Design intent behind {@link SHEET_RECORD_CONTRACT} — not shown verbatim to drivers. */
export const SHEET_RECORD_CONTRACT_NOTES = [
  "Drivers cannot rewrite history; they review, sign, and act in the present week.",
  "Incorrect past data is corrected through manager amendment (reason required), not silent edits — avoiding both tampering and unfixable wrong records.",
  "The legal record is the named driver's attestation (signature), not the manager's edit — manager changes always return to the driver to sign.",
  "Rolling compliance may read prior weeks for calculations; that is not the same as editing or operating on a past sheet.",
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
 * 1. Past week, never signed → archive (read-only). Manager may amend → driver signs (first attestation) → locked archive.
 * 2. Past week, signed → manager amends (reason) → signature cleared, pending driver re-sign → driver signs as if first instance → locked archive.
 * 3. Current week → driver logs; may sign when ready; if manager amends after sign, same re-sign loop before treating as final.
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
  /** @deprecated Use formatSignPastWeekTitle — past weeks are not "this week". */
  SIGN_ARCHIVED_WEEK_TITLE: "Sign this week's record",
  SIGN_ARCHIVED_WEEK_BODY:
    "This week is closed for logging. Sign to confirm the record is yours. Ask your manager first if anything still looks wrong.",
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
  "The app opens on this week — the only week where you log Work, Break, and End shift.",
  "Past weeks are closed for logging. Open them from Your weeks to review, export, or sign.",
  "Your signature means you attest that week is your record. It is not the manager's signature.",
  "If something in a past week is wrong, your manager corrects it (with a reason on file). When you both agree it is right, open that week and sign — or sign again after a correction.",
  "Unsigned past weeks show as reminders with links to sign — they do not block logging on the current week.",
] as const;

/** Bullets: how weeks appear to the driver in the UI. */
export const USER_VISIBLE_SHEET_STATE_BULLETS = [
  "Current regulatory week — the slice you open to log work and breaks from now.",
  "Past weeks — read-only; sign to attest, or re-sign if your manager corrected the record.",
  "Signed weeks — you have attested that slice; manager edits require your signature again.",
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

/** @deprecated Use formatUnsignedPastWeeksReminderMessage — logging is not blocked. */
export function formatUnsignedPastWeeksBlockMessage(count: number): string {
  return formatUnsignedPastWeeksReminderMessage(count);
}

/** Banner when signing a past (archived) week — weekOfLabel e.g. "22 Mar 2026". */
export function formatSignPastWeekTitle(weekOfLabel: string): string {
  return `Sign week of ${weekOfLabel}`;
}

export function formatSignPastWeekBody(weekOfLabel: string): string {
  return (
    `This is a past week (week of ${weekOfLabel}), not the current week. It is closed for logging. ` +
    `Sign to confirm that slice of your record is yours. To log work now, use Drive home → Continue logging.`
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

export function formatPastWeekArchiveSubtitle(weekOfLabel: string): string {
  return `Archive · week of ${weekOfLabel}`;
}

/** When driver cannot sign a past week until manager fixes data (read-only archive). */
export function formatSignBlockedPastWeekMessage(validationError: string, weekOfLabel: string): string {
  return (
    `${validationError} This past week (week of ${weekOfLabel}) is read-only here. ` +
    `Ask your manager to correct the record, then return to sign — or go to Drive home to log the current week.`
  );
}
