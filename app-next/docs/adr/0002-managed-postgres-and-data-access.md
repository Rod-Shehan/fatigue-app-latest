# ADR 0002: Managed PostgreSQL production & data access

## Status

**Accepted** — 2026-06-02

## Context

- The app is built on **Next.js + Prisma + PostgreSQL** (`prisma/schema.prisma`). Local Postgres and **Vercel** hosting are appropriate for development and production.
- **SharePoint + Power Automate** will publish **PDF hard copies** of attested fatigue records (same output as `GET /api/sheets/[id]/export`).
- We need **one read path** for the manager PWA and future fleet statistics — not CSV imports into SharePoint lists, not a split brain where the app reads SharePoint for history.
- **Legal retention** is **≥ 3 years** for records (WA Reg 184G, HVNL s 341). See [record-retention-and-compliance-lookback.md](../regulatory/record-retention-and-compliance-lookback.md).
- **Commercial-grade database hosting** is a **business decision** when customer count, SLA, backups, and AU residency justify cost — not an emergency refactor.

## Decision

### 1. System of record (application)

**Managed PostgreSQL** is the **only** system of record for operational and historical **structured** fatigue data (sheets, `days` JSON, audit, messages, compliance inputs).

- The **manager app and APIs** read and write **only via Prisma → Postgres** (`DATABASE_URL`).
- **No** SharePoint lists, **no** CSV round-trips, and **no** second query location for in-app features.
- Optional JSON files in SharePoint (sibling to PDF) are **human/IT backup only** — not consumed by Circadia.

### 2. SharePoint / Power Automate (publish-only)

SharePoint receives **outbound** artifacts after archive eligibility:

- **PDF** per attested sheet (human legal copy).
- Optional **manifest** for browsing in the library (not the app’s database).

Power Automate orchestrates upload; Circadia does not read SharePoint for sheet data.

### 3. When to archive (PDF), not when to delete (DB)

> A fatigue record is archived **30 days after** the driver attests it (including re-attestation after amendment). The app never archives drafts, and never re-archives unless **`signedAt`** changes.

- **Archive eligibility:** `signedAt + 30 days` (constant `ARCHIVE_DELAY_DAYS = 30` when implemented).
- **Rationale:** Buffer for amendments and process fixes; outside the ~28-day roadside produce window; low burst load (batch eligible sheets).
- **DB purge** is **decoupled:** do not delete hot rows merely because 30 days passed. Purge only after **verified** PDF upload and per [ADR 0002](./0002-managed-postgres-and-data-access.md) / business retention on Postgres.

Until managed Postgres is sized for multi-year retention, **keep signed sheets in Postgres** for manager views and future stats; SharePoint holds the long-term **PDF** copy.

### 4. Production database migration (when customers justify it)

**No application rewrite** — change hosting and operations:

| Step | Action |
|------|--------|
| 1 | Provision **managed PostgreSQL** (staging + prod) |
| 2 | `prisma migrate deploy` against new URL |
| 3 | `pg_dump` / `pg_restore` or greenfield seed |
| 4 | Connection string with SSL + **pooler** (serverless-friendly) |
| 5 | Cutover `DATABASE_URL`; smoke-test auth, sheets, compliance, PDF export |

**Preferred vendors** (choose on business grounds):

- **Azure Database for PostgreSQL – Flexible Server** — aligns with SharePoint / PA / Blob.
- **Neon** (or Vercel Postgres) — simple ops if app host is Vercel.
- **Supabase** — Postgres only if adopting extras deliberately.
- **AWS RDS / Cloud SQL** — if customer mandates a cloud.

**Not** primary sheet store: Firestore, Cosmos, SharePoint lists.

### 5. What commercial Postgres buys (vs dev-only hosting)

- Automated backups and point-in-time recovery  
- Storage growth without VM disk surprises  
- Connection pooling for serverless Next on Vercel  
- HA / read replicas when needed for reporting  
- Clear path to keep **years** of signed rows in one DB for manager statistics without cold-tier complexity  

### 6. Business triggers (examples — set real thresholds in ops)

Upgrade to paid managed Postgres when one or more apply:

- Fleet / driver count exceeds pilot limits on a single instance  
- Contract requires defined backup RPO/RTO  
- AU data residency or enterprise procurement requires Azure (or other)  
- Operational time on self-hosted DB exceeds value of managed service  

Until then, dev/small Postgres remains acceptable; **code is already production-shaped**.

## Consequences

### Positive

- Single API and DB for manager UX and future analytics.  
- SharePoint stays in the team’s strength zone (publish PDFs) without data-access fragmentation.  
- Archive delay and PDF export do not force premature DB purge or CSV pipelines.  
- Postgres migration is a **connection-string and ops** change, not a redesign.

### Negative / trade-offs

- Long retention in Postgres increases **disk cost** (usually modest vs PDF storage in SharePoint).  
- PDF generation (Chromium) remains on the **app host**; DB tier does not replace export compute.  
- Must enforce “app never reads SharePoint” in future features (discipline, not tooling).

## Related

- [0001 Multi-jurisdiction architecture](./0001-multi-jurisdiction-fatigue-architecture.md)  
- [WEEKLY_ARCHIVE_EXPORT.md](../WEEKLY_ARCHIVE_EXPORT.md) — PDF packaging and PA flow  
- [record-retention-and-compliance-lookback.md](../regulatory/record-retention-and-compliance-lookback.md)  
- `src/lib/record-retention.ts` — retention vs rule-engine lookback constants  

## Changelog

| Date | Note |
|------|------|
| 2026-06-02 | Accepted: managed Postgres as SoR; SharePoint publish-only; archive at signedAt+30; no CSV/list app reads |
