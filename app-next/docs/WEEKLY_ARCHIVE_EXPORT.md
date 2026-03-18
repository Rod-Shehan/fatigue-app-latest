# Weekly archive export (Azure/SharePoint) — design note

Goal: keep the database small while maintaining a **fully identified**, **human-readable** record archive.

## Requirements (as agreed)

- **Endpoint**: SharePoint / Azure
- **Re-import**: not required
- **Identification**: records must be fully identified
- **Retention**: keep ~**1 week** in DB (life of the work week), then purge after week completes
- **Security**: secure DB → Azure; records not considered sensitive
- **Readability at endpoint**: records must be unpackable into a readable record at the destination

## Recommended export format

**Weekly ZIP** containing:

- **PDF per sheet** (the readable “record”)
- **Index file** for quick searching/sorting in SharePoint
  - `index.csv` (Excel-friendly) and/or `manifest.json` (machine-friendly)

Suggested naming to keep files self-identifying:

- ZIP: `fatigue-archive_weekStarting=YYYY-MM-DD_generatedAt=YYYY-MM-DDTHH-mmZ.zip`
- PDFs: `sheet_weekStarting=YYYY-MM-DD_driver=SAFE-NAME_sheetId=UUID.pdf`
- Index: `index.csv`

Recommended `index.csv` columns:

- `sheetId`
- `weekStarting`
- `driverName`
- `secondDriverName`
- `driverType`
- `createdAt`
- `submittedAt`
- `pdfFileName`
- `eventsCount`

Notes:

- PDF is the “source of truth” human-readable record at the endpoint.
- The index provides bulk browsing/search without opening every PDF.

## Scheduling (weekly export + purge)

Run on a fixed day/time (e.g. **end-of-week** boundary):

- **Export**: all sheets for the last completed work week
- **Upload**: ZIP (+ checksum if desired) to Azure Blob and/or SharePoint document library
- **Purge**: delete DB rows older than the retention window (e.g. older than 7–8 days), or purge only those successfully exported

Implementation options (when ready):

- **Azure Function** (Timer Trigger) that calls an authenticated app endpoint
- **Vercel Cron** calling an authenticated app endpoint
- **Logic Apps / Power Automate** for Blob → SharePoint copy if SharePoint must be the final landing spot

## Azure vs SharePoint landing recommendation

- **Best archival store**: **Azure Blob Storage** (cost + lifecycle rules + scale)
- **Best browsing location**: **SharePoint** (non-technical access)

Common pattern:

1. App exports ZIP → Blob
2. Automation copies ZIP (+ index) into the chosen SharePoint library/folder

