# Weekly archive export (Azure/SharePoint) — design note

> **Policy:** [ADR 0002](./adr/0002-managed-postgres-and-data-access.md) — Postgres is the app’s system of record; SharePoint is **publish-only** for PDFs.  
> **Retention:** Legal minimum **≥ 3 years** (WA Reg 184G, HVNL s 341). See [record-retention-and-compliance-lookback.md](./regulatory/record-retention-and-compliance-lookback.md).

Goal: produce **human-readable PDF hard copies** of attested weekly sheets in SharePoint (via Power Automate), without making SharePoint or CSV lists a second data source for the Circadia manager app.

## When to archive (agreed)

> A fatigue record is archived **30 days after** the driver attests it (including re-attestation after amendment). The app never archives drafts, and never re-archives unless **`signedAt`** changes.

| Rule | Detail |
|------|--------|
| **Eligible** | `status = completed`, `signedAt` set, `now >= signedAt + 30 days` |
| **Skip** | Unsigned / draft weeks |
| **Re-archive** | Only when `signedAt` changes (manager amendment → driver re-sign) |
| **Not the same as DB purge** | Postgres may retain structured data longer for manager use and stats |

Implementation constant (when built): `ARCHIVE_DELAY_DAYS = 30`.

## Data access (do not split the manager app)

| Store | Role | Circadia app reads? |
|-------|------|---------------------|
| **PostgreSQL** | Structured sheets, events-in-JSON, compliance, future stats | **Yes — only** |
| **SharePoint** | PDF (+ optional manifest for humans) | **No** |
| **CSV → SharePoint lists** | Not used for app analytics | **No** |

Power Automate uploads PDFs; managers query history through the **API and Postgres**, not imported lists.

## Requirements

- **Endpoint**: SharePoint document library (via PA; optional Azure Blob staging)
- **Re-import into app**: not required
- **Identification**: PDF filenames and manifest include driver, week, sheet id
- **Security**: authenticated export endpoint; cron secret for scheduled jobs
- **Readability**: same PDF as manual **Export PDF** in the app (`GET /api/sheets/[id]/export`)

## Recommended export format

**Per eligible sheet** (or weekly ZIP batch):

- **PDF per sheet** — the readable legal record
- **Optional `manifest.json`** per batch — checksums, `signedAt`, upload status (for ops, not app queries)

Suggested naming:

- ZIP: `fatigue-archive_weekStarting=YYYY-MM-DD_generatedAt=YYYY-MM-DDTHH-mmZ.zip`
- PDF: `sheet_weekStarting=YYYY-MM-DD_driver=SAFE-NAME_sheetId=UUID.pdf`

Optional manifest fields for SharePoint browsing (human/ops):

- `sheetId`, `weekStarting`, `driverName`, `signedAt`, `pdfFileName`, `exportedAt`, `checksum`

**Note:** A spreadsheet index in the ZIP is fine for **people** opening the archive folder; it must not become a second database the app depends on.

## Scheduling

**Nightly (recommended):** export all sheets where `signedAt + 30 days <= now` and not yet archived for that `signedAt`.

**Power Automate:** HTTP call to secured app endpoint → receive PDF or ZIP → **Create file** in SharePoint library.

Implementation options:

- **Power Automate** recurrence → `POST /api/archive/...` (when implemented)
- **Azure Function** timer → same endpoint
- **Vercel Cron** → same endpoint

Process **one sheet PDF at a time** where possible to limit Chromium memory on serverless hosts.

## Azure vs SharePoint landing

1. App generates PDF → optional Blob staging  
2. PA copies to **SharePoint** library (final human-facing location)  
3. App marks `archivedForSignedAt` (or equivalent) after verified upload  
4. **DB purge** (if ever) only after verified archive — separate business decision; see ADR 0002

## Production database

Dev/local Postgres is fine for pilots. **Managed PostgreSQL** (Azure, Neon, etc.) when customer levels justify backups, SLA, and scale — migration is `DATABASE_URL` + ops, not an app rewrite. See [ADR 0002](./adr/0002-managed-postgres-and-data-access.md).
