# Project scope: Hot / cold electronic records (backup, retention, and access)

**Status:** **P0–P5 done** (owner stream 2026-08-08). P1–P4 technical/ops + UX. **P5** counsel-ready SaaS schedule draft. **Next: P6** graduation design (optional) or **P7** remaining doc alignment.  
**Owner doctrine locked (2026-08-08):** the **legal electronic record** is the **structured data + signature image** (plus attestation metadata and audit), not a PDF.  
**Stack:** Circadia24 monorepo — shared Neon Postgres (`app-next` + `circadia-command`); Cloudflare R2 for encrypted database copies and future cold packs.  
**Surfaces:** especially **Enterprise** (fleet history / date-range queries); EWD and Command inherit the same retention rules where they show historical records.

**Related**

| Doc | Role |
|-----|------|
| [record-retention-and-compliance-lookback.md](../regulatory/record-retention-and-compliance-lookback.md) | ≥3 year retention vs rule lookback vs roadside 28-day produce |
| [ADR 0002](../adr/0002-managed-postgres-and-data-access.md) | Postgres as app system of record; SharePoint publish-only for PDFs |
| [WEEKLY_ARCHIVE_EXPORT.md](../WEEKLY_ARCHIVE_EXPORT.md) | Optional PDF publish to SharePoint (customer habit / filing — **not** Circadia SoR) |
| [product-surfaces-legacy-ewd-enterprise.md](../../../docs/architecture/product-surfaces-legacy-ewd-enterprise.md) | Enterprise as manager/owner product surface |
| [db-backup-restore.md](../ops/db-backup-restore.md) | P1 nightly encrypted Neon → R2 dump + restore runbook |
| [cold-access-fulfillment.md](../ops/cold-access-fulfillment.md) | P4 ops path: decrypt / restore / extract electronic SoR pack |
| [saas-schedule-electronic-records-hot-cold.md](./saas-schedule-electronic-records-hot-cold.md) | P5 draft SaaS schedule for counsel (SoR, hot/cold, SLA, fees) |
| [ewd-record-custody-and-pdf-delivery.md](./ewd-record-custody-and-pdf-delivery.md) | Living counsel note: 3-year JSON hold, forced weekly PDF to customer, operator duty not delegable |
| [ADR 0005](../adr/0005-client-named-ewd-container.md) | **Global design:** named client container; SoR / Plan C extract is per `tenant_id` |

> **Disclaimer:** This document is product and architecture design for Circadia. It is **not legal advice**. Client contract wording must be reviewed by qualified counsel before use in commercial agreements.

---

## 1. Why this project exists

Circadia must always be able to **produce the electronic source of truth** for customers, investigators, and courts for at least the legal retention period (WA Reg 184G / HVNL-style **≥ ~3 years**).

That source of truth is:

1. **What was logged** — structured sheet / timeline data (`days` JSON and related fields).  
2. **The attestation** — signature image + `signedAt` (and amendment / audit history).  
3. **Enough context to interpret it** — driver identity, week, jurisdiction, rest declarations, status.

A **PDF** is a **view** rebuilt from (1)+(2) whenever needed. It is useful for offices that still think in paper, but it is **not** Circadia’s durable legal artefact. Electronic discovery and subpoena practice will typically go to the **data and the signature**, not to “whichever PDF someone filed last year.”

Keeping every byte of every year in a **hot** (always-queryable) database forever is expensive and unnecessary for day-to-day driving and management. Industry-normal pattern:

- **Hot** = recent / operational data — instant in the app.  
- **Cold** = older retained records — still Circadia’s responsibility, but **retrieved from storage and reassembled** when needed (hours/days SLA, not “click and open like last week”).

This project defines that path end-to-end: **backup → cold store → restore/reassemble → authorised access**, plus **plain-language contract and UI copy** so customers understand *why* older history is not instant.

---

## 2. Goal (deliverable outcome)

Deliver a designed, shippable capability where:

1. **Live (hot) database** holds the window needed for normal operations (logging, compliance lookback, roadside produce, recent Enterprise reporting).  
2. **Off-site encrypted backups** (and later, intentional cold packs) preserve the electronic record **independently of Neon’s short history window**.  
3. **Cold access** lets an authorised customer (or Circadia on their behalf) request records **outside the live window** and receive them in a **sensible, timely** way — with clear expectation that this is a **retrieval**, not an instant date-range filter.  
4. **Client contract / SaaS schedule** explains this in business language (cost, efficiency, legal preservation) without overtechnical jargon.  
5. **Enterprise UI** never pretends cold years are clickable like last month; it guides the user into a **request / retrieve** flow (or shows “not in live range — request from archive”).

Out of scope for v1 of this project: rewriting rule engines, changing rolling-timeline IP, or making SharePoint PDFs authoritative.

---

## 3. Source of truth doctrine (non-negotiable for design)

| Artefact | Role |
|----------|------|
| Structured data + signature image + `signedAt` + audit | **Electronic system of record** — what Circadia must preserve and produce |
| PDF / Weekly Trip Sheet / roadside pack | **Generated view** — optional for customer filing habit; regenerable from SoR |
| Neon PITR / branch restore | Fast operational recovery within Neon’s history window |
| Encrypted off-site DB dumps / cold packs (e.g. R2) | Independent copies for long retention, disaster recovery, and cold production |
| Customer-held PDF folders | Their choice — **not** Circadia’s substitute for SoR |

**Design implication:** Retention and backup policy must protect **data + signature**, for the full legal window. PDF publish (SharePoint / email) remains optional convenience and must not be used as the excuse to drop electronic SoR early.

*Note:* Older notes that treat SharePoint PDF as the long-term “authoritative after purge” copy should be **revisited** when hot/cold purge rules are approved — purge of hot rows is only safe if a **Circadia-controlled electronic archive** (not PDF-only) remains authoritative.

---

## 4. How this fits the current backup path

Think in **tiers**, not separate products:

```text
Driver / Manager / Enterprise / Command
        │
        ▼
┌───────────────────┐
│  HOT — Neon live  │  Instant queries, compliance lookback, roadside ~28d,
│  shared Postgres  │  recent Enterprise date ranges
└─────────┬─────────┘
          │ nightly (and on-demand) encrypted pg_dump
          ▼
┌───────────────────┐
│  COLD STORE — R2  │  Encrypted dumps / later attested packs
│  (Circadia-owned) │  Retention ≥ legal window for electronic SoR
└─────────┬─────────┘
          │ authorised retrieve → decrypt → restore/extract → reassemble
          ▼
┌───────────────────┐
│  COLD ACCESS      │  Timed delivery of SoR (data + signature ± audit)
│  (ops / Enterprise│  Optional: regenerate PDF *from* retrieved SoR
│   request flow)   │  Labelled as reproduction, not “the original PDF”
└───────────────────┘
```

| Step | Purpose |
|------|---------|
| Neon live | Operational truth *right now* |
| Encrypted dump → R2 | Independent copy if Neon fails, history window expires, or live data is damaged |
| Cold retrieve | Customer / investigator needs a week or year **not** in the hot window |
| Reassemble | Restore subset or full dump to a secure workspace; extract sheet rows + signatures; optionally rebuild PDF for convenience |

**v1 ops (proposed, pending approval):** nightly GitHub Actions `pg_dump` → encrypt → Cloudflare R2 (dedicated backups bucket), using Neon **unpooled** URL.  
**v1.x product:** define **hot window length**, **cold request SLA**, and Enterprise UX.  
**v2:** intentional “graduate to cold” packs (per tenant / per year) so retrieval is faster than restoring an entire nightly dump — still the same SoR bytes.

---

## 5. Live vs cold — what the customer experiences

### 5.1 Hot (live DB) — normal product

- Logging, signing, amendments.  
- Compliance engines (rule lookback — today ~12 weeks of history loaded for checks).  
- Roadside produce (~28 days).  
- Enterprise: pick a date range **inside the live window** → results appear like today.

Exact **hot window** (e.g. 12 months / 24 months / “all signed sheets until cost forces graduation”) is a **commercial + ops decision** to lock in a later phase. Until cold graduation exists, pilot may keep all signed sheets hot — backup still required.

### 5.2 Cold — not a silent date picker

Enterprise (example) **must not** imply:

> “Choose any dates in the last three years and the grid will fill instantly.”

When the requested range falls **outside the live DB**:

1. UI states clearly that those records are **in long-term storage**.  
2. User (or Circadia support under contract) **requests retrieval**.  
3. Circadia reconstitutes from cold store (decrypt, restore/extract, verify).  
4. Delivery within an agreed **SLA** (e.g. same business day / 2 business days — TBD).  
5. Deliverable is the **electronic record** (and optionally a freshly generated PDF marked as produced from that record).

This is normal for regulated systems that separate operational cost from long retention. The UX job is honesty and a clear path — not pretending cold is hot.

### 5.3 Plain language for the product (draft — not final copy)

> **Recent records** are available immediately in Circadia.  
> **Older retained records** are kept safely in long-term storage so we can meet legal retention without keeping every year on the live system.  
> If you need those older records, request them from [Enterprise / Support]. We retrieve and reassemble them from storage — usually within [SLA].  
> The authoritative record is your **signed electronic data** (what was logged and the signature), not a PDF file. We can produce a PDF from that data when you need a printable copy.

---

## 6. Client contract / SaaS schedule (design input)

Circadia’s commercial terms should set expectations **before** Enterprise ships multi-year history UX. Suggested themes for counsel to turn into schedule language:

### 6.1 What Circadia preserves

- Circadia maintains the **electronic work diary / fatigue record** as structured data and the driver’s (or relevant) **signature**, for at least the period required by applicable law (and any longer period stated in the order form).  
- Circadia can **produce** that electronic record to the customer and, where lawfully required, to regulators or courts.  
- **Printable PDFs** may be generated from the electronic record; PDF copies held by the customer are for convenience and do not replace Circadia’s electronic record unless the contract expressly says otherwise.

### 6.2 Why hot and cold (cost and efficiency — plain English)

- Keeping many years of every fleet’s full history on the **live** system would raise cost and slow everyday use.  
- Circadia therefore keeps a **working (live) period** online for normal operations.  
- Records outside that period remain **retained and retrievable** from secure long-term storage.  
- Retrieval is a **service action** (automated or assisted) with a stated timeframe — not the same as browsing last week’s sheets.

### 6.3 Customer responsibilities

- Customer remains the **record keeper** under applicable fatigue / WHS / HVNL rules unless the contract assigns a different role.  
- Customer should use Circadia’s produce / retrieval channels for audits and legal holds rather than assuming a local PDF folder is complete.  
- Customer notifies Circadia promptly of legal holds that must pause deletion or graduation of specific records.

### 6.4 What we do **not** promise in contract fluff

- Instant online access to the entire retention period in Enterprise date pickers.  
- That a PDF emailed to SharePoint is the sole Circadia legal archive.  
- Unlimited free forensic restore of the whole platform without an agreed process / fee for extraordinary requests (optional commercial lever — TBD).

---

## 7. Workstreams (upcoming deliverable breakdown)

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **P0** | Doctrine + this scope accepted by owner | **Done** 2026-08-08 |
| **P1** | Ops: encrypted Neon → R2 nightly dump + restore runbook | **Done** (prod secrets + first dump 2026-08-08; schedule 09:00 AWST) |
| **P2** | Define **hot window** and **cold SLA** commercially | **Locked** 2026-08-08 (§8) |
| **P3** | Enterprise UX: live range vs “request from archive” | **Done** 2026-08-08 — Overview banner + request dialog + `POST /api/manager/archive-request` |
| **P4** | Cold access workflow | **Done** 2026-08-08 — [cold-access-fulfillment.md](../ops/cold-access-fulfillment.md) + `scripts/db-backup` list/download/decrypt/extract-sor |
| **P5** | Contract schedule text | **Done** 2026-08-08 — [saas-schedule-electronic-records-hot-cold.md](./saas-schedule-electronic-records-hot-cold.md) (draft for counsel) |
| **P6** | Graduation design (optional after P1–P4) | **Next (optional)** — never PDF-only purge |
| **P7** | Align ADR 0002 / retention / WEEKLY_ARCHIVE docs | Partial (ADR note); **next docs cleanup** |

**Explicit non-goals until approved:** changing time-rule IP; enabling parked checklist photo R2 as the DB backup bucket; production Neon/Vercel/R2 changes without separate owner confirmation.

---

## 8. Decision log (P2 — **locked** owner 2026-08-08)

| # | Decision | **Locked value** |
|---|----------|------------------|
| **H1** | Hot window length | **Keep all signed sheets hot** until first paying multi-fleet scale forces graduation; then revisit (likely 24 months hot). Pilot does not graduate to cold yet. |
| **H2** | Cold retrieval SLA | **2 business days** standard (AWST); urgent legal-hold / regulator produce escalated same day when practicable |
| **H3** | Who can request cold access | **Tenant owner** + Circadia ops; named managers only if owner delegates |
| **H4** | Delivery format | **SoR export pack** (sheet JSON + signature + `signedAt` + audit) required; PDF optional, labelled as reproduction from electronic record |
| **H5** | R2 retention of full dumps | **≥ 3 years** (match electronic retention); R2 lifecycle, no aggressive script delete |
| **H6** | SharePoint PDF publish | Optional customer habit; **not** SoR; does not justify dropping electronic archive |
| **H7** | Fee for extraordinary restores | **Included:** standard cold requests within fair use; **chargeable:** whole-DB forensic restores / bulk litigation exports beyond fair use (define in order form) |

---

## 9. Success criteria

- Owner and counsel can point to one doctrine: **data + signature = record**.  
- Nightly off-site encrypted DB copies exist and a restore has been **practised** at least once in non-prod.  
- Enterprise (or support process) can fulfil a cold request without improvising.  
- A customer reading the SaaS schedule understands **why** old history is not one click, and still trusts that Circadia can produce the record for audits and courts.  
- No design path that deletes hot SoR while leaving **only** PDFs behind.

---

## Changelog

| Date | Note |
|------|------|
| 2026-08-08 | Initial upcoming project scope — hot/cold access integrated with DB backup path; electronic SoR doctrine; contract and Enterprise UX design notes |
| 2026-08-08 | P0 accepted; P1 workflow/uploader/runbook added; P2 commercial defaults proposed for owner lock |
| 2026-08-08 | P2 H1–H7 locked as proposed; production R2 + GitHub secrets + first backup approved |
| 2026-08-08 | P3 Enterprise Older records UX + archive-request API; P4 next |
| 2026-08-08 | P4 cold access fulfillment runbook + SoR extract tooling |
| 2026-08-08 | P5 SaaS schedule draft for electronic records / hot-cold retrieval |
