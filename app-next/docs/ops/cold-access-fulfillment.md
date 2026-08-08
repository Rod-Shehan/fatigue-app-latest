# Cold access fulfillment (P4)

**Status:** Ops workflow for fulfilling Enterprise **Older records** requests.  
**Doctrine:** electronic SoR = **data + signature + attestation/audit** — not PDF.  
**SLA (H2):** **2 business days** AWST standard; urgent legal hold / regulator escalate same day when practicable.  
**Who (H3):** tenant owner + Circadia ops (named managers if delegated).

Related:

- Product scope: [hot-cold-record-access-project-scope.md](../product/hot-cold-record-access-project-scope.md)
- Backup / decrypt basics: [db-backup-restore.md](./db-backup-restore.md)
- In-app request: `POST /api/manager/archive-request` → email/log to ops
- Tooling: `scripts/db-backup/`

---

## When to use which source

| Situation | Source | Notes |
|-----------|--------|--------|
| Pilot / H1 (all sheets still hot) | **Live Neon** (`DATABASE_URL_UNPOOLED`) | Fastest — dump restore not required |
| Sheet graduated off hot DB (future P6) | Decrypt R2 dump → `pg_restore` to throwaway DB → extract | Use dump **on or after** the end of the requested range |
| Neon disaster / full DR | Same as restore runbook | Then extract SoR pack from restored copy |

---

## Fulfillment checklist (ops)

1. **Receive request** — email subject `[Circadia] Archive record request …` or server log `[archive-request]`. Note `requestId`, week range, reason, requester.
2. **Acknowledge** requester within SLA window (optional auto-reply later).
3. **Produce SoR pack** (below).
4. **Deliver** pack securely (encrypted email attachment, secure link, or customer-controlled channel). Label any PDF as **reproduction from electronic record**.
5. **Record** delivery (request id, timestamp, object keys used, recipient).
6. **Wipe** local `work/*.dump` and decrypted files from the ops machine.

---

## Tooling (`scripts/db-backup`)

```powershell
cd scripts/db-backup
npm ci

# Optional: load R2 + encryption key from your password manager into the shell env
# R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
# BACKUP_ENCRYPTION_KEY  (same as GitHub secret / .backup-encryption-key.local)
```

### A. List R2 dumps

```powershell
npm run list
```

### B. Download + decrypt (when you need a dump, not live Neon)

```powershell
$env:R2_OBJECT_KEY = "backups/2026-08-08_03-21-32.dump.enc"
npm run download
# writes work/2026-08-08_03-21-32.dump.enc

$env:ENC_PATH = "work/2026-08-08_03-21-32.dump.enc"
$env:BACKUP_ENCRYPTION_KEY = "…"   # do not commit
npm run decrypt
# writes work/2026-08-08_03-21-32.dump

# Restore into throwaway DB (Postgres 17 client):
# pg_restore --no-owner --no-acl -d "$env:RESTORE_DATABASE_URL" work/2026-08-08_03-21-32.dump
```

### C. Extract electronic SoR pack

**From live Neon (pilot / H1):**

```powershell
$env:DATABASE_URL_UNPOOLED = "postgresql://…direct…?sslmode=require"
$env:FROM_WEEK = "2026-01-04"
$env:TO_WEEK = "2026-01-25"
$env:REQUEST_ID = "arc_…"          # optional
$env:REASON = "Regulator produce"  # optional
# $env:DRIVER_NAME = "Jane Driver" # optional
npm run extract-sor
# writes work/sor-pack-….json
```

**From restored dump DB:**

```powershell
$env:DATABASE_URL_UNPOOLED = $env:RESTORE_DATABASE_URL
$env:SOR_SOURCE = "restored_dump"
npm run extract-sor
```

### Pack contents

JSON artefact `circadia-electronic-sor-pack` schemaVersion **1**:

- Sheet identity, `weekStarting`, `days` (parsed JSON), `signature`, `signedAt`, status  
- Related `AuditEvent` rows  
- Request metadata + doctrine note  

Regenerate a Weekly Trip Sheet / roadside PDF **from this pack** only if the customer wants a printable view — do not treat the PDF as the legal artefact.

---

## In-app path (already shipped P3)

Managers open **Older records** on Driver Overview → submit range + reason → Circadia ops receives email (when Resend configured) or server log. P4 is this fulfillment path.

---

## Not in P4 (later)

- Automated ticket board / status UI for requesters  
- Per-year cold packs (faster than full nightly dump restore) — P6 adjacent  
- Charging workflow for extraordinary whole-DB forensic restores (H7 commercial)
