# Roadside PDF & QR snapshot (S6)

## PDF export (superseded for printed extras)

Week **Export PDF** (`GET /api/sheets/[id]/export`) and **Produce 28 day roadside PDF** are **Weekly Trip Sheet pages only** — no Circadia header, **Roadside compliance summary**, QR, or shift-log appendix. Owner decisions 2026-08-19 (roadside produce) and 2026-08-20 (week Export). See `docs/product/weekly-trip-sheet-pdf-project-scope.md`.

A `layout: "full"` renderer still exists in `sheet-jspdf-export.ts` for tests; it is not used by Export PDF or roadside produce.

## Optional QR (read-only JSON)

The signed snapshot API remains for time-limited JSON (not printed on the trip-sheet PDFs):

1. `ROADSIDE_QR_IN_PDF_ENABLED=true`  
2. A signing secret is configured: `ROADSIDE_SNAPSHOT_SECRET` (preferred) or `NEXTAUTH_SECRET`  
3. `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`) resolves to the correct public origin for the link  

**Endpoint:** `GET /api/sheets/[id]/roadside-snapshot?t=<token>`  

- No session cookie; **token required** (HMAC, default TTL 14 days).  
- Response: JSON with violations, warnings, disclaimer, and expiry.  

**Security:** Treat the token like a **capability**: anyone with the QR can read that snapshot until expiry. Rotate `ROADSIDE_SNAPSHOT_SECRET` to invalidate old links.

## Related

- `docs/product/positioning.md`  
- `docs/roadmap/approval-gates.md` — S6  
