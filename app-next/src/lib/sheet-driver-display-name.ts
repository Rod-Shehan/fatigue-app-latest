/**
 * Resolve the name shown as “this sheet’s driver”.
 * Fleet oversight (manager/owner) must always use the sheet field — never the
 * viewer’s session name — so identity stays tied to the record being reviewed.
 * Field drivers prefer their session login name (source of truth for their sheets).
 */
export function resolveSheetDriverDisplayName(opts: {
  sheetDriverName: string | null | undefined;
  sessionDisplayName?: string | null | undefined;
  isFleetOversight: boolean;
  sessionLoading?: boolean;
}): string {
  const sheet = (opts.sheetDriverName ?? "").trim();
  if (opts.isFleetOversight) return sheet || "—";
  if (opts.sessionLoading) return "…";
  const session = (opts.sessionDisplayName ?? "").trim();
  return session || sheet || "—";
}
