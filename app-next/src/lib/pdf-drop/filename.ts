const UNSAFE = /[^\w.-]+/g;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const PDF_DROP_ROOT_FOLDER = "Circadia PDF drop";

/** Visible folder/file label — spaces allowed, slashes stripped. */
export function visibleDropName(raw: string, fallback = "untitled"): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80) || fallback;
}

export function safePdfDropSegment(raw: string, fallback = "unknown"): string {
  const cleaned = raw
    .trim()
    .replace(/[\s"\r\n\\/]+/g, "-")
    .replace(UNSAFE, "")
    .replace(/^\.+/, "")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 80) || fallback;
}

export function weekFolderLabel(weekStarting: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weekStarting.trim());
  if (!m) return visibleDropName(`week ${weekStarting}`, "week");
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `week ${Number(m[3])} ${month} ${m[1]}`;
}

export function clientDropFolderPath(legalName: string, slug: string): string {
  return `${PDF_DROP_ROOT_FOLDER}/${visibleDropName(legalName, safePdfDropSegment(slug, "client"))}`;
}

export function weekTripSheetDropPath(opts: {
  legalName: string;
  slug: string;
  weekStarting: string;
  driverName: string;
}): string {
  const week = weekFolderLabel(opts.weekStarting);
  const driver = visibleDropName(opts.driverName, "driver");
  return `${clientDropFolderPath(opts.legalName, opts.slug)}/${week}/${driver}.pdf`;
}
