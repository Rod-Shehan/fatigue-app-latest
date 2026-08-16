# Checklist photo object storage — PARKED

**Status:** Parked 2026-08-01 (owner).

**Interim:** email completed checklist PDF packs to `circadia24@gmail.com` (Circadia holding copy). Neon still keeps structured checklist JSON (answers, signatures, timestamps). Photos may remain as data URLs in day JSON until a real object store ships.

**Later:**
- Per-client email distribution (customer delivery)
- Optional Cloudflare R2 (or SharePoint) for photo bytes + keys/hashes on the record (Q1)

**Custody (2026-08-16):** Photos are **not** part of the base Electronic Record. R2 is for the **paid photo-retain add-on** only. Base tenants must not persist photo data URLs in `days` JSON. See [ewd-record-custody-and-pdf-delivery.md](../product/ewd-record-custody-and-pdf-delivery.md) §4. Photo retain is a **per-container** config-pack switch ([ADR 0005](../adr/0005-client-named-ewd-container.md)), not a forever-global flag.

Do not enable R2 production env until that slice is deliberately un-parked.
