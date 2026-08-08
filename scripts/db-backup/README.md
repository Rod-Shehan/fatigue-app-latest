# Circadia Neon → R2 backup + cold SoR tooling

- **Upload (CI):** GitHub Action dumps/encrypts; `upload.ts` puts `*.dump.enc` in R2  
- **Cold fulfill (P4):** list → download → decrypt → `pg_restore` (if needed) → `extract-sor`  
- **Docs:** `../../app-next/docs/ops/db-backup-restore.md`, `../../app-next/docs/ops/cold-access-fulfillment.md`

```bash
npm ci
npm run list
npm run download    # needs R2_OBJECT_KEY
npm run decrypt     # needs ENC_PATH + BACKUP_ENCRYPTION_KEY
npm run extract-sor # needs DATABASE_URL_UNPOOLED + FROM_WEEK + TO_WEEK
```

Never commit `work/`, `.backup-encryption-key.local`, or dump files.
