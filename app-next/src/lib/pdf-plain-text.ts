/**
 * ASCII-safe text for PDF embedding (Helvetica / Chromium print).
 * Unicode like ≥ and × can corrupt glyph runs in PDF text (ampersand/garble artefacts).
 */

export function sanitizePdfPlainText(input: string): string {
  return String(input ?? "")
    .replace(/\u2265/g, ">=") // ≥
    .replace(/\u2264/g, "<=") // ≤
    .replace(/\u00d7/g, "x") // ×
    .replace(/\u2022|\u00b7/g, "-") // • ·
    .replace(/\u2013|\u2014/g, "-") // – —
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}
