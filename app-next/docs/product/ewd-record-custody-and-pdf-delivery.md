# EWD record custody, client availability, and forced PDF delivery

**Status:** Owner product direction **2026-08-16** — living counsel / build note. Revisit whenever retention, export, email, archive, or contract copy changes.  
**Not legal advice.** Contract wording must be reviewed by qualified counsel before use in customer agreements. Confirm WA WHS / WAHVA / HVNL duties against current official sources.

**Owner locks this note exists to protect:**

1. Circadia’s electronic system of record (structured diary + signature + audit).  
2. The accredited operator’s **non-delegable** duty to retain records.  
3. Honest PDF labelling (human reproduction, not the diary).  
4. Circadia’s **business**: we generate and keep **records of compliance** — that is what the client pays for (§12).

**Related**

| Doc | Role |
|-----|------|
| [hot-cold-record-access-project-scope.md](./hot-cold-record-access-project-scope.md) | Electronic Record = data + signature + audit; PDF is a view |
| [saas-schedule-electronic-records-hot-cold.md](./saas-schedule-electronic-records-hot-cold.md) | Counsel-ready SaaS schedule draft (SoR pack, retrieval SLA) |
| [record-retention-and-compliance-lookback.md](../regulatory/record-retention-and-compliance-lookback.md) | ≥3 year retention vs rule lookback vs 28-day roadside |
| [ADR 0002](../adr/0002-managed-postgres-and-data-access.md) | Postgres is app SoR; SharePoint PDF is publish-only |
| [ADR 0005](../adr/0005-client-named-ewd-container.md) | **Global design:** named client container; identity on every file |
| [client-named-ewd-container.md](../../../docs/architecture/client-named-ewd-container.md) | Repo-level index for the same global design |
| [WEEKLY_ARCHIVE_EXPORT.md](../WEEKLY_ARCHIVE_EXPORT.md) | Optional SharePoint PDF publish 30 days after attest |
| [weekly-trip-sheet-pdf-project-scope.md](./weekly-trip-sheet-pdf-project-scope.md) | What the weekly PDF contains |
| [compliance-checklist-modules-project-scope.md](./compliance-checklist-modules-project-scope.md) | Checklist PDF separate from fatigue; email = delivery |
| [checklist-photo-r2-parked.md](../architecture/checklist-photo-r2-parked.md) | Photo object store parked; see §4 photos add-on |
| [roadside-pdf-s6.md](../architecture/roadside-pdf-s6.md) | 28-day roadside produce + optional QR snapshot |
| [db-backup-restore.md](../ops/db-backup-restore.md) | Plan B: encrypted Neon → R2. Plan C suggestion: §13 |

---

## 1. One-sentence doctrine (use in counsel / onboarding)

> Circadia retains the electronic work diary for at least three years. Circadia must deliver a PDF copy of each attested week to the customer’s records address. The customer must keep that copy. Neither delivery nor storage by Circadia transfers the customer’s record-keeping duty. The PDF is a printable reproduction of the electronic record, not a replacement for it.

---

## 2. What the record is

| Artefact | Role | Who “has” it |
|----------|------|----------------|
| **Electronic Record** | System of record: week sheet JSON (`days` events + grids), checklist **answers / paths / timestamps**, signature image, `signedAt`, amendment / audit. **Photos are not in the base record** (§4). | Circadia holds and can produce. Customer **owns** the diary data as the subscriber. |
| **Weekly Trip Sheet PDF** | Human-readable **reproduction** generated from the Electronic Record (same as in-app **Export PDF**) | Customer **must receive and retain** for their own filing. Circadia keeps a send ledger, not as a substitute SoR. |
| **28-day roadside PDF** | Driver produce-at-inspection pack | Driver on demand. **Not** the operator’s 3-year filing copy. **Not** auto-emailed. |
| **Checklist PDFs** | Separate CoR / WAHVA form packs (FFW, Prestart, Load) — never merged into roadside | Delivery to the same records inbox when that send path ships; still not the fatigue SoR. |
| **Customer SharePoint / mailbox** | Their habit / office file | Their choice of how to file the PDF. **Not** Circadia’s query store. **Not** an excuse to drop JSON. |

**Bank analogy (keep using this):** Circadia holds the electronic ledger. The weekly PDF is the statement. On audit or exit, Circadia produces the ledger extract (SoR pack) **and** can regenerate the statement. The customer does not “own the statement instead of the ledger.”

### Options considered (2026-08-16) — do not reopen without owner + counsel

| Option | Verdict |
|--------|---------|
| 1. JSON alongside every routine PDF | Only at **produce / export / exit**. Not the daily habit. |
| 2. Keep JSON like a bank ledger | **Custody model — locked.** |
| 3. Provide both when they need to take something away | **Produce model — locked** (SoR pack + PDF labelled reproduction). |
| 4. PDF on demand only | Allowed as *how humans read*. **Rejected** as the *only* client artefact. |
| 5. Treat PDF as the client’s auditable record | What offices *read*. **Must not** become what Circadia *keeps* as SoR. |
| 6. JSON is Circadia property; PDF is the client’s record | **Rejected.** Makes the printout the client’s legal copy and hides the real diary. |

---

## 3. Two duties (do not collapse)

These run **in parallel**. One does not discharge the other.

### A. Accredited operator (customer)

- Record keeper under WA Reg 184G / WAHVA-style accreditation / HVNL s 341-style duties (confirm with counsel).  
- Must retain work / break / non-work records for **at least three years**.  
- **Cannot delegate** that legal responsibility to Circadia, a mailbox, or a vendor.  
- They may keep records however they like (PDF folder, SharePoint, print). They still own the duty.  
- They typically **think** the record is a PDF. Product and contract must give them a PDF **and** tell them it is a copy of the electronic diary.

### B. Circadia (processor / SaaS)

- Holds the **Electronic Record** for **at least three years** from the relevant last entry (or longer if law or the order form requires).  
- Can **produce** that record to the customer (and, where lawful, support regulator / court produce).  
- **Must deliver** the weekly PDF reproduction to the customer’s nominated records address after each attested week (forced provision — §5).  
- Delivery does **not** appoint Circadia as the customer’s record keeper.  
- Circadia must **not** delete or “graduate away” the Electronic Record merely because a PDF was sent or filed.

If the customer never files the PDF, **their** duty is unmet. Circadia’s send ledger proves Circadia delivered. Circadia’s Neon / cold archive proves Circadia still has the Electronic Record.

---

## 4. How much data Circadia holds (cost)

**Commitment:** ≥ **3 years** of Electronic Record storage. That is the WAHVA / WA / HVNL-style **minimum**, not a target to undercut.

| Payload | Cost character | Implication |
|---------|----------------|-------------|
| Events + minute grids + week header | Small | Not the cost problem. Included in base 3-year hold. |
| Week + checklist **signatures** (data URL) | Moderate | Keep; required for attestation. Included in base. |
| Checklist **answers / paths / timestamps** | Small | Included in base Electronic Record. |
| Checklist **photos** | **High** if persisted | **Not in the base record.** Paid retain add-on only (below). |
| Encrypted DB dumps / cold packs (R2) | Required independent copy of the Electronic Record | Hot Neon is not the only copy. See hot/cold project. |

**Do not** treat emailed PDFs as permission to purge JSON early. Purge of hot rows is only safe if a **Circadia-controlled electronic archive** (not PDF-only) remains authoritative.

Rule-engine lookback (~12 weeks) and roadside 28 days are **not** retention. Do not size storage from those windows.

### Photos — optional paid retain (owner 2026-08-16)

**Principle:** A thing is part of Circadia’s retained Electronic Record **only if it was written into that record at completion**. Hours, answers, paths, timestamps, and signatures are in from the start. A photograph is in **only if** Circadia persists it (or keeps a Circadia-held PDF that embeds it).

**Commercial split (owner direction):**

| Plan | What Circadia retains ≥3 years | Photos |
|------|--------------------------------|--------|
| **Base (no photo add-on)** | JSON Electronic Record only | **Not saved.** Not part of the legal record Circadia contracted to keep. Assist context at generation time only. |
| **Photo retain (paid extra)** | Same JSON **plus** photo bytes (object store) + key/hash on the record | Then **in** that customer’s retained pack for the add-on term. |

Owner position for counsel to confirm: photographs are **not a legal requirement** for the fatigue / hours record (or, as proposed, for the checklist *answers* Circadia retains). They are optional context. Extra charge is for **storage**, not for making the diary valid.

**Build rules (or the split fails):**

- Base tenant: **do not** write photo data URLs into `days` / `checklists[]`. Today’s capture path does exactly that — that must change before we claim photos are outside the record.  
- Do **not** email a checklist PDF that embeds photos, then delete the bytes and say Circadia never had them.  
- Forced **weekly fatigue** PDF stays photo-free (already true).  
- Mode C “photo required at capture” may remain a **form completeness** rule (honest loader-not-obtained gap). It does **not** mean Circadia stores the picture unless photo retain is purchased.  
- Optional flag on the JSON (“photo taken, not retained”) is allowed; the image bytes are not.  
- Paid retain: R2 (or equivalent) + hash/key; same retrieve story as the Electronic Record, separate line item. Un-park [checklist-photo-r2-parked.md](../architecture/checklist-photo-r2-parked.md) only for **paid** tenants.

**Counsel one-liner:**

> Circadia’s retained Electronic Record is the structured diary and signatures. Photographs are optional context and are retained only if the customer purchases photo storage. If they do not, photographs are not written into the record.

**Counsel must confirm** before order-form copy says “photos are never part of the legal record” for CoR / WAHVA defect practice (usage vs statutory duty).

---

## 5. Forced PDF delivery (not optional)

**Why force it:** If PDF delivery is optional, many operators will never file a copy and will treat Circadia as their only cabinet. That is Circadia intervening in a liability the operator cannot give away.

**What “forced” means in the service:**

1. Customer must nominate an **operator records inbox** (org-level). Using the EWD / attesting a week requires this address.  
2. After each week is **attested** (`status = completed`, signature + `signedAt`), Circadia **sends** the weekly fatigue PDF (same generator as `GET /api/sheets/[id]/export`) to that inbox.  
3. Circadia writes a **send ledger** row: artefact, sheet id, recipient, trigger, PDF checksum, provider id, sent / failed / skipped, time.  
4. Failed send is Circadia’s problem to retry. A full or abandoned inbox is the customer’s problem.  
5. Re-attest (new `signedAt` after amendment) queues a **new** send. Do not overwrite the old ledger row.  
6. Every such PDF is labelled a **reproduction from the electronic record**.

**What forced does *not* mean:**

- Circadia becomes the record keeper.  
- The PDF replaces JSON.  
- Roadside 28-day packs are auto-emailed.  
- Circadia’s Gmail holding inbox (`circadia24@gmail.com`) is the customer destination (interim checklist path only — retire once the records inbox exists).

### Address book (do not overload login email)

| Slot | Where | Used for |
|------|--------|----------|
| **Operator records inbox** | New org field (same policy surface as workshop contact) | Forced weekly PDF + later checklist copies |
| **Optional driver copy** | Roster `recordsEmail` or opt-in login email | That driver’s own week / FFW — **not** the fleet. *Open — §8.* |
| **Workshop / WAHVA** | Existing `maintenanceContactEmail` | Prestart **defects** only — not fatigue weeks, not FFW |
| **Circadia holding** | Interim `CHECKLIST_ARCHIVE_EMAIL` | Circadia ops copy until per-client distribution ships |

Login email is **identity**, not filing.

---

## 6. Who needs the JSON, and when

Day-to-day, the client **views** the record **in the app** (EWD week sheet, Enterprise). They do not handle raw JSON to use the product.

| Who | When | What they get |
|-----|------|----------------|
| Driver (roadside) | Inspection, now | 28-day roadside PDF on demand (device or server). Not JSON. |
| Operator / office | After each attested week | Forced weekly PDF to records inbox. |
| Operator / auditor who wants paper | Any time | Same weekly PDF on demand (Export PDF). |
| Operator / counsel / Circadia ops | Audit, legal hold, exit, dispute, regulator produce | **SoR pack**: structured data + signature + `signedAt` + audit, **plus** optional PDF labelled reproduction. |
| Circadia engines / support | Always | JSON in Postgres (and cold copies). |

JSON is not hidden as “Circadia property.” It is produced when the **electronic** record is required. PDF is what humans read without understanding source-of-truth.

---

## 7. Live PDF families (do not mix)

| Family | Auto-email? | Unit |
|--------|-------------|------|
| Weekly fatigue sheet | **Yes — forced after attest** (when inbox + ledger ship) | One PDF per driver-week. Two-up = one sheet (primary + second name). Fleet = N PDFs, not one booklet. |
| 28-day roadside | **No** | One driver, last 28 calendar days. Produce only. |
| Checklist pack | Later, same inbox / ledger | One type per file (FFW / Prestart / Load). Never inside roadside. |

**Proposed checklist timing** (not a substitute for the weekly liability PDF):

- **FFW** — send on signature (personal, complete then).  
- **Prestart** — send on signature (including FAIL visible). Workshop address is extra, not a delay.  
- **Dimension & Load** — send on driver sign even if loader pending (honest CoR gap); send again if loader later completes. Do not hold to Saturday.

Nightly digest may be safer than one giant multi-attachment mail (provider size limits). Process one weekly PDF at a time if Chromium memory is tight (same constraint as archive export).

---

## 8. Open decisions (do not implement as if locked)

| # | Question | Lean | Needs |
|---|----------|------|--------|
| O1 | Driver copy of the weekly PDF? | Opt-in per driver, or operator inbox only | Owner |
| O2 | Load: send on driver sign + follow-up, or hold until loader resolved? | Send now with pending, then update | Owner |
| O3 | SharePoint 30-day archive vs immediate email | **Both allowed.** Email is the forced customer copy. SharePoint remains optional Circadia/customer publish habit. Neither is SoR. | — |
| O4 | Block week attest if records inbox missing / last send failed? | Lean **yes** for missing inbox; **no** hard-block attest on transient mail fail (retry + banner) | Owner + counsel |

Roadside stays produce-only unless the owner explicitly reverses O-adjacent policy.

---

## 9. What this forces in the build (when we implement)

Do **not** start from more PDF layout. The layout already exists.

1. Org **records inbox** (required).  
2. **Send ledger** table + manager visibility (sent / failed / retry) per driver-week.  
3. Auto-generate and send weekly PDF after attest.  
4. Reproduction label on the PDF.  
5. Retire Circadia holding inbox as the customer destination.  
6. Keep 3-year JSON + signature + audit (hot/cold path unchanged).  
7. Guides / in-app help: “Circadia keeps the electronic diary; the PDF is your printable copy; you must keep it.”  
8. **Photos:** stop persisting data URLs on base tenants; photo retain is a paid add-on (R2 + hash), not default Neon.  
9. **Client identity on the file** ([ADR 0005](../adr/0005-client-named-ewd-container.md)): stamp legal name + `tenant_id` + config pack version on PDF, SoR, Plan C. Photo retain and form modules are per-container, not a forever-global `SystemPolicy`.

Production env, DNS, and mailbox changes still need **explicit owner approval** per production-change rules.

---

## 10. Counsel notes (paste / challenge list)

Use these as the briefing list when revisiting with counsel. They are product positions, not executed terms.

1. Customer remains the record keeper; Circadia is not appointed sole record keeper unless a future agreement expressly says so.  
2. Electronic Record definition matches the hot/cold schedule: structured data + signature image + attestation metadata + audit.  
3. PDF / print / SharePoint / email copies are convenient views; Circadia can regenerate them from the Electronic Record.  
4. Minimum Circadia retention: **three years** (or longer if law / order form).  
5. **Forced** weekly PDF delivery to a customer-nominated records address after attestation — so the customer holds a copy they understand.  
6. Forced delivery **does not** transfer or reduce the customer’s statutory retention duty.  
7. Circadia **does not** treat customer-held PDFs as Circadia’s archive or as grounds to drop the Electronic Record.  
8. Standard audit / exit fulfilment is an **SoR pack**; any PDF in that pack is labelled a reproduction.  
9. Retrieval of older-than-live records follows the hot/cold SLA (draft: two AWST business days; best-efforts same-day for regulator / legal hold).  
10. Fair-use retrieval vs extraordinary forensic restore remains a commercial schedule item.  
11. **Photos:** not in the base Electronic Record. Retained only if the customer purchases photo storage. If not purchased, photo bytes are not written into the record. (Confirm CoR / WAHVA photo practice with counsel.)  
12. Disclaimer on fatigue PDFs remains: Circadia24 record; **not** an NHVR-approved EWD; not legal advice.  
13. Email is delivery, not photo custody. A mailed PDF that embeds photos is a Circadia-held reproduction of those photos — do not do that on the base plan.  
14. Circadia’s commercial offering is the **compliance record** (create, retain, produce, weekly readable copy). The PDF renderer may change; the Electronic Record must remain producible for the retention period (§12).  
15. **Plan C (suggestion, §13):** per-client encrypted exhibit (physical drive + that client’s key) for court/order produce. Not the live store. Clone, do not surrender the only copy. Counsel to confirm exhibit practice.  
16. **Client identity (global, ADR 0005 / §14):** every produce artefact names the operator (`tenant_id` + legal name + config pack version). Circadia branding alone is not enough.

**Draft customer-facing line (UI / onboarding):**

> Circadia keeps your electronic work diary. The PDF is a printable copy of that diary. You must keep the copies we send to your records email. For an audit we can give you both — the printout, and the signed electronic record it was made from.

---

## 11. Revisit checklist (every time this topic comes back)

- [ ] Are we about to make PDF the only thing the customer can take away?  
- [ ] Are we about to delete or cold-drop JSON because “they have the PDF”?  
- [ ] Are we treating login email or workshop email as the records inbox?  
- [ ] Are we auto-emailing the 28-day roadside pack?  
- [ ] Are we merging checklists into the fatigue roadside PDF?  
- [ ] Is attest possible with no records inbox (if forced delivery has shipped)?  
- [ ] Does contract copy still say Circadia is not their record keeper?  
- [ ] Are we writing photo bytes into `days` JSON on a tenant that has not purchased photo retain?  
- [ ] Are we embedding photos in a Circadia-held / emailed PDF on the base plan?  
- [ ] If photo retain is on: are bytes off Neon (object store + hash), still retrievable for the add-on term?  
- [ ] Are we selling “automatic weekly filing” before inbox + send ledger exist?  
- [ ] If using Plan C: is the drive **that client only**, encrypted, cloned for the court, key not the fleet key?  
- [ ] Does every PDF / SoR / Plan C artefact carry the client legal name + `tenant_id` + config pack version ([ADR 0005](../adr/0005-client-named-ewd-container.md))?

If any answer is wrong, stop and re-read §§2–5 before coding.

---

## 12. First official driver and 40-driver sale (2026-08-16)

**Context:** First real-world Circadia EWD conversion (one driver, official). The same story must hold for a business owner buying for **40+ drivers**, and remain true for **three years** even though PDF layout and app UX will change.

**What Circadia sells:** not a logging toy. Circadia **creates, keeps, and produces** the compliance record, and **puts a readable copy in the operator’s hands** every attested week.

### Resilience despite product updates

Do not freeze the PDF renderer. Freeze **what was logged**, and **deliver a snapshot** when the week is signed.

| Layer | Role when the app looks different in 2028 |
|-------|-------------------------------------------|
| **JSON + signature + audit** | The record. Regenerable. What Circadia is paid to keep. |
| **PDF delivered at attest** | Frozen human copy of *that* week, in *that* layout. Why forced delivery matters. |
| **Export PDF later** | May look newer. Still a reproduction of the same JSON. |
| **28-day roadside** | Inspection pack. Not the 3-year office file. |

### Live this morning vs locked-not-built

| Live now | Locked in this note, not built |
|----------|--------------------------------|
| Driver logging → Neon JSON | Org **records inbox** (required) |
| **Export PDF** (weekly) | **Auto** weekly email after attest |
| **Produce 28 day roadside PDF** | **Send ledger** (sent / failed / retry) |
| Checklist PDFs on demand | Reproduction label on the PDF |
| Database backups | Stop persisting photo bytes on the base plan |

For **one driver**, run the locked model **by hand**. For **40 drivers**, that is not honest — close the build gap (§9 items 1–4, 8) before the fleet sale is operationally true.

### Today — first official driver (manual Circadia process)

1. Get the **business owner’s records email in writing** (office inbox — not the driver’s login, not the workshop). That is the destination the contract will later require.  
2. Record the operator’s **legal name** (and a slug). Stamp that name on the Export PDF filename / cover and on any Plan C folder until `tenant_id` exists ([ADR 0005](../adr/0005-client-named-ewd-container.md)). Do not put a second company’s drivers on this deployment.  
3. Driver logs as normal. **JSON on Neon is the record from the first tap.**  
4. When they **sign the week**: tap **Export PDF** immediately and send that file to the records email. Keep a dated Circadia ops copy (`legal name`, `driver`, `weekStarting`, `signedAt`). This is forced delivery, done once by a human.  
5. Show the driver **Produce 28 day roadside PDF** (Drive home / gear). Inspector pack, not the office file.  
6. Checklists: useful, optional in trial. **Do not sell photo archive.** If they take photos, they are context — not Circadia’s 3-year record (code may still embed data URLs until §9.8 ships; do not advertise that).  
7. Do not delete weeks. Do not treat the emailed PDF as permission to drop the sheet.

Enough for **one** accredited conversion. Not enough to promise the owner “the system files itself.”

### What to tell the business owner (40-driver sale)

**You are buying a record of compliance.** Circadia:

- Keeps the **electronic work diary** (work, rest, signed) for **at least three years**.  
- **Delivers a weekly PDF** to **your** records inbox after each week is signed — so you hold a copy the law expects *you* to keep. Circadia does not become your record keeper.  
- Lets the driver **produce the last 28 days** at roadside from the phone.  
- Can **reproduce** the week later from the electronic record if the PDF layout changes or a file is lost.

**You** nominate the records email, keep the PDFs, and remain the accredited operator.

**Photos** are not in the base record. Context only, unless you buy photo storage later.

**Price** is for that record service (create, retain, produce, weekly copy).

### Before 40 drivers (build order)

1. Records inbox on the org (required).  
2. Auto weekly PDF after attest + send ledger.  
3. Reproduction line on the PDF.  
4. Stop saving photo bytes on the base plan.  
5. Manager view: this week’s copies sent.

SharePoint, R2 photos, and a packaged SoR zip can wait. Without 1–3, do not sell “we handle the records” at fleet scale.

### Do not say today

- That this is an NHVR-approved EWD.  
- That they can skip filing because Circadia keeps it.  
- That weekly PDFs already email themselves.  
- That photos are kept for three years.

---

## 13. Plan C — per-client exhibit drive (suggestion, 2026-08-16)

**Status:** Owner **suggestion** for counsel / ops — not built, not the live path. Does **not** replace Plan A or Plan B.

**Intent:** In a high-profile matter (e.g. fatigue-related prosecution years later), Circadia can produce **that client’s** record as a **physical drive** under court order, and provide **that drive’s key**. The court receives a sealed exhibit, not a login to Circadia and not a dump of every other customer.

This is **not** a home server as the product disk. The box (and a second local drive) only hold **Plan C masters**. Drivers and the app never talk to it.

### Plans A / B / C

| Plan | What | Role |
|------|------|------|
| **A** | Live Neon Electronic Record | Day-to-day create / read. First place to extract while sheets are hot. |
| **B** | Nightly encrypted `pg_dump` → R2, retain ≥ 3 years | Off-site DR and cold restore. Shared platform dump today (one Neon). See [db-backup-restore.md](../ops/db-backup-restore.md). |
| **C** (suggested) | **Per-client** encrypted archive + physical exhibit drive | How Circadia **produces** one operator to a court without opening the fleet. Spare iron; not availability for logging. |

Availability when it matters is **A or B first**. Plan C is produce-and-spare: if A and B are gone, or the order is “hand over the media.”

### What must be on a client drive

Only that operator’s Electronic Record:

- Attested weeks: `days` JSON, signature image, `signedAt`, amendment / audit  
- Identity: **client legal name + `tenant_id` + config pack version** ([ADR 0005](../adr/0005-client-named-ewd-container.md)), driver names, `weekStarting`, sheet ids, jurisdiction  
- Manifest: generated at (UTC/AWST), source snapshot (Plan A extract and/or Plan B restore point), checksums of each object  
- Optional: weekly PDF reproductions as delivered (labelled reproductions)

**Must not** include other customers, Circadia platform secrets, or a decrypted “working folder.”

Today Neon is **shared**. A raw platform `pg_dump` on a drive is **not** Plan C. Plan C requires a **per-client SoR extract** (and, if useful, a full encrypted platform dump kept separately for Circadia DR only).

### Keys

- **Per-client key** (or a key envelope that opens only that drive).  
- One Circadia key that unlocks every client is unsafe under a single order.  
- Key custody: not only on the home server. Dual custody (same class of problem as `BACKUP_ENCRYPTION_KEY`).  
- Court receives the **clone’s** key material as counsel directs — not a key that unlocks Plan A or other clients.

### How to hand it over

The court keeps exhibits. Do **not** surrender the only copy.

1. Keep a **master** per client: encrypted image/archive on the Plan C server; second local drive holds ciphertext of those masters.  
2. On order / legal hold: **clone** the master onto a **new** physical drive. Record serial, hash, date, who cloned.  
3. Hand the **clone + that client’s key**.  
4. Master stays in Circadia custody.

### Cadence

Do not rewrite forty live USB sticks every night.

- **Continuous:** per-client encrypted archive updated from Plan A (or from a Plan B restore) — nightly or weekly.  
- **Physical media:** refresh on a schedule (e.g. monthly) **and** always cut a fresh clone on hold/order.  
- **First official driver:** one client archive + one spare clone in the safe is enough to start.

### Counsel to confirm

- Whether a labelled encrypted drive + key is an acceptable produce form, or they also want a hash-verified file extract.  
- Chain-of-custody wording (who may clone, who may open).  
- That handing Plan C does **not** make Circadia the operator’s record keeper (§3) and does **not** replace forced weekly PDF to the client (§5).

---

## 14. Client identity on the file (global design)

**Canonical:** [ADR 0005](../adr/0005-client-named-ewd-container.md) and [docs/architecture/client-named-ewd-container.md](../../../docs/architecture/client-named-ewd-container.md).

Custody, PDF delivery, photo retain, and Plan C all assume **one named operator** owns the file. That is a **platform-wide** rule, not a custody-only detail:

- One codebase; customisation is a **config pack**, not a forked EWD.  
- Stamp **legal name + `tenant_id` + config pack version** on every weekly PDF, SoR pack, and Plan C drive.  
- Until the Tenant table exists: stamp the first official driver’s **legal client name**; do not mix a second company on this deployment as if they were isolated.

---

## Document control

| Version | Date | Note |
|---------|------|------|
| 0.1 | 2026-08-16 | Owner session: SoT JSON, bank-ledger custody, forced weekly PDF, 3-year hold, non-delegable operator duty, who/when for JSON vs PDF |
| 0.2 | 2026-08-16 | Photos not in base legal record; paid photo-retain add-on; do not persist data URLs unless purchased |
| 0.3 | 2026-08-16 | First official driver + 40-driver sale: Circadia sells the compliance record; manual PDF process today; auto-send required before fleet |
| 0.4 | 2026-08-16 | Plan C suggestion: per-client encrypted exhibit drive + key for court produce; not live store |
| 0.5 | 2026-08-16 | §14 pointer: client identity / named container is global design (ADR 0005), not a custody-only note |
