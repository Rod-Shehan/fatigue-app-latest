# Neon DB backup & restore (encrypted → Cloudflare R2)

**Status:** P1 ops path — workflow in repo; **enable only after** R2 bucket + GitHub Actions secrets are configured (explicit owner approval for production).  
**Doctrine:** [hot-cold-record-access-project-scope.md](../product/hot-cold-record-access-project-scope.md) — electronic SoR = **data + signature**, not PDF.  
**Workflow:** [`.github/workflows/db-backup.yml`](../../../../.github/workflows/db-backup.yml)

---

## What this protects

Nightly (and manual) **encrypted** Postgres custom-format dumps of the shared Circadia Neon database (Manager + Command). Purpose:

1. Independent copy outside Neon’s short point-in-time history window.  
2. Foundation for **cold** retrieval when older electronic records are no longer in the live (hot) DB.  
3. Disaster recovery if the live project is lost or corrupted.

This is **not** a substitute for Neon instant restore for yesterday’s accidental delete (use Neon PITR first when still in-window).

---

## Artefact format

| Step | Detail |
|------|--------|
| Dump | `pg_dump -Fc` (Postgres **custom** format) |
| Encrypt | `openssl enc -aes-256-cbc -pbkdf2 -salt` with `BACKUP_ENCRYPTION_KEY` |
| Object key | `backups/YYYY-MM-DD_HH-MM-SS.dump.enc` (UTC stamp) |
| Restore tool | Decrypt → `pg_restore` (not `psql`) |

---

## One-time setup (production — needs owner approval per step)

### 1. Cloudflare R2

1. Create a **dedicated** bucket (example name: `circadia-db-backups`).  
   Do **not** reuse a future checklist-photo or incident-video bucket.  
2. Create an R2 API token with **Object Read & Write** limited to that bucket.  
3. Note: Account ID, Access Key ID, Secret Access Key, bucket name.  
4. Configure bucket **lifecycle** so objects are retained **≥ 3 years** (electronic SoR retention). Prefer lifecycle rules over aggressive delete-in-script.

### 2. Neon

1. Copy the **direct / unpooled** connection string (hostname **without** `-pooler`).  
2. Prefer a least-privilege role that can `SELECT` / dump (or use existing direct URL for pilot).  
3. Confirm Neon **history window** / plan for short-term PITR separately.

### 3. Encryption key

```bash
openssl rand -base64 48
```

Store only in GitHub Actions secrets (and an offline recovery location owned by Circadia — password manager / sealed ops note). Losing this key makes R2 objects unusable.

### 4. GitHub repository secrets

Repo: `Rod-Shehan/fatigue-app-latest` → **Settings → Secrets and variables → Actions**

| Secret | Value |
|--------|--------|
| `DATABASE_URL_UNPOOLED` | Neon direct URL (`sslmode=require`) |
| `BACKUP_ENCRYPTION_KEY` | Output of `openssl rand -base64 48` |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 token access key |
| `R2_SECRET_ACCESS_KEY` | R2 token secret |
| `R2_BUCKET_NAME` | e.g. `circadia-db-backups` |

These are **not** Vercel app env vars.

### 5. Enable and verify

1. Merge workflow to `main`.  
2. **Actions → Neon DB backup to R2 → Run workflow** (manual dispatch).  
3. Confirm object appears in R2 under `backups/…dump.enc`.  
4. Practice **decrypt + pg_restore into a throwaway Neon branch / local Postgres** (see below) at least once.

Schedule: `0 1 * * *` UTC = **09:00 AWST** (quiet after overnight EWD logging).

---

## Restore runbook (cold / DR)

### A. Download

From Cloudflare R2, download the chosen `backups/….dump.enc` to a secure machine (ops laptop or locked CI runner). Do not leave decrypted dumps on shared disks.

### B. Decrypt

```bash
export BACKUP_ENCRYPTION_KEY='…'   # same secret as GitHub
openssl enc -d -aes-256-cbc -pbkdf2 -salt \
  -in 2026-08-08_16-00-00.dump.enc \
  -out 2026-08-08_16-00-00.dump \
  -pass env:BACKUP_ENCRYPTION_KEY
```

### C. Restore with pg_restore

Use a **target** that is not production until verified (new Neon branch, empty local DB, or dedicated restore project).

```bash
# Example: restore into empty database URL (direct / unpooled)
pg_restore --no-owner --no-acl -d "$RESTORE_DATABASE_URL" 2026-08-08_16-00-00.dump
```

Match `pg_restore` / `pg_dump` **major version to Neon** (production is **Postgres 17**). The GitHub Action installs `postgresql-client-17`.

### D. Produce electronic SoR for a cold request

After restore (or after extracting from a restored copy):

1. Locate `FatigueSheet` (and related) rows for the requested driver / date range.  
2. Export **structured data + signature + `signedAt` + audit** (SoR pack).  
3. Optionally regenerate a PDF **labelled as a reproduction from the electronic record**.  
4. Deliver under the cold-access SLA (see project scope H2).  
5. Securely delete local decrypted dumps when finished.

Full in-app cold request UX is **P3–P4** — until then this runbook is the ops path.

### E. Full production cutover (rare)

Only with explicit owner approval: point apps at a restored database after integrity checks. Prefer Neon PITR when the incident is still inside the history window.

---

## Local dry-run (optional)

```bash
cd scripts/db-backup
npm ci

# After you have produced a local .dump.enc yourself:
export BACKUP_FILE_PATH=/path/to/stamp.dump.enc
export R2_ACCOUNT_ID=…
export R2_ACCESS_KEY_ID=…
export R2_SECRET_ACCESS_KEY=…
export R2_BUCKET_NAME=circadia-db-backups
npm run upload
```

Do not commit secrets or dump files.

---

## Failure modes

| Symptom | Likely cause |
|---------|----------------|
| Workflow fails on “pooler” check | Secret is pooled URL — use unpooled |
| `pg_dump` SSL / connection errors | Wrong URL, IP allowlist, or expired password |
| OpenSSL decrypt fails | Wrong `BACKUP_ENCRYPTION_KEY` |
| R2 upload 403 | Token scope / wrong account or bucket |
| Restore schema errors | Postgres major version mismatch |

---

## Related

- Product scope: [hot-cold-record-access-project-scope.md](../product/hot-cold-record-access-project-scope.md)  
- Retention vs lookback: [record-retention-and-compliance-lookback.md](../regulatory/record-retention-and-compliance-lookback.md)  
- Uploader: `scripts/db-backup/upload.ts`
