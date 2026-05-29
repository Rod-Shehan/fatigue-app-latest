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
  /** Driver-facing: unsigned past week after manager fix (or never signed). */
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
  "You may be asked to sign past weeks before logging new work on this week.",
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

/** Future: block logging work at NOW until past unsigned weeks are signed (copy only). */
export const UNSIGNED_WEEKS_GATE_HINT =
  "You may need to sign past weekly records before starting a new shift entry.";

/** Driver-facing message when work logging is blocked due to unsigned past weeks. */
export function formatUnsignedPastWeeksBlockMessage(count: number): string {
  if (count <= 0) return "";
  return `You have ${count} past week record${count === 1 ? "" : "s"} that need your signature before you log new work. Sign each from Your Sheets, then return here.`;
}
