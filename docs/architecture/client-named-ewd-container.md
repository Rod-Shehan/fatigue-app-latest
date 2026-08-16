# Global design: client identity and named EWD container

**Status:** Accepted as **global Circadia design** — 2026-08-16 (owner).  
**This-week build (in progress):** `Tenant` + `tenantId` on users, drivers, sheets, regos, and route presets. Session-scoped APIs. Circadia client manager at `/circadia` for platform admins.  
**Canonical decision record:** [ADR 0005](../../app-next/docs/adr/0005-client-named-ewd-container.md)  
**Not this week:** dedicated Neon, RLS, config packs, Plan C extract, Command billing.

This is **not** a custody footnote and **not** a Command-only tenancy sketch. It applies to every Circadia surface that creates, brands, stores, or produces a compliance file:

- Driver EWD and Enterprise manager (`app-next`)
- Circadia Command
- Weekly / roadside / checklist PDFs
- Electronic Record (JSON + signature + audit)
- Plan B platform backup vs Plan C per-client exhibit
- Photo-retain and form-pack add-ons

## Locked decisions (do not reopen without owner)

1. **One codebase.** Do not fork the EWD per client. Customisation is a **versioned config pack** (photos, forms, inclusions), not a custom binary.
2. **Named container.** Each paying operator is `tenant_id` + legal name + slug + isolation tier + current config pack.
3. **Identity on every file.** Stamp legal name + `tenant_id` + **config pack version** on every sheet, PDF, SoR extract, and Plan C drive.
4. **Isolation is a tier.** Shared Neon + RLS first; dedicated Neon later is the **same** container, harder wall — not a different product.
5. **Plan C is per container.** Extract `WHERE tenant_id = ?` + that client’s key. A shared `pg_dump` on USB is not Plan C.
6. **Interim (first official driver).** Stamp a legal client name on Export PDF and any Plan C folder **before** the Tenant table exists. Do not mix a second company on the same deployment as if they were isolated.

## Related

| Doc | Role |
|-----|------|
| [ADR 0005](../../app-next/docs/adr/0005-client-named-ewd-container.md) | Full decision, consequences, implementation notes |
| [command-multi-tenant-subscription-outline.md](./command-multi-tenant-subscription-outline.md) | Tenant entity, Option A/B/C isolation, phases |
| [ewd-record-custody-and-pdf-delivery.md](../../app-next/docs/product/ewd-record-custody-and-pdf-delivery.md) | Custody, forced PDF, photos, Plan C — files must carry client identity |
| [product-surfaces-legacy-ewd-enterprise.md](./product-surfaces-legacy-ewd-enterprise.md) | Product **surface** (EWD vs Enterprise host) is not the client container |
