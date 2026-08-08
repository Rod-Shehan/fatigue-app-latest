# Circadia Neon → R2 backup uploader

Upload-only helper for encrypted `pg_dump -Fc` archives.

- **Workflow:** `../../.github/workflows/db-backup.yml`
- **Restore runbook:** `../../app-next/docs/ops/db-backup-restore.md`
- **Product doctrine:** `../../app-next/docs/product/hot-cold-record-access-project-scope.md`

```bash
npm ci
export BACKUP_FILE_PATH=/path/to/stamp.dump.enc
export R2_ACCOUNT_ID=…
export R2_ACCESS_KEY_ID=…
export R2_SECRET_ACCESS_KEY=…
export R2_BUCKET_NAME=circadia-db-backups
npm run upload
```
