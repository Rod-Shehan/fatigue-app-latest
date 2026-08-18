# ADR 0005: Client identity and named EWD container

## Status

**Accepted as global design** — 2026-08-16 (owner).  
**This-week implementation started:** `Tenant` row + `tenantId` on EWD users/drivers/sheets/regos/presets; APIs deny cross-client reads; `npm run tenant:provision` and Circadia staff desk (`staff-desk.circadia24.com`) create, rename, and pause clients.  
**Still later:** dedicated Neon, RLS, versioned config packs, Plan C extract. Command already carries a pilot `tenant_id_uuid` on some incident paths.

**Not legal advice.** Record-custody and produce practice: [ewd-record-custody-and-pdf-delivery.md](../product/ewd-record-custody-and-pdf-delivery.md).

## Context

Circadia’s product is the **compliance record**. Weekly PDFs, SoR packs, photo retain, and Plan C (per-client exhibit drive) only work if every file is attributable to **one paying client**.

Today:

- One shared Neon. Users, drivers, `FatigueSheet`, and `SystemPolicy` (`id = default`) are **deployment-global**.
- PDFs and exports brand **Circadia24**, not the operator’s legal name.
- Customisation (forms, photo retain, inclusions) has nowhere to live except global flags.
- Command multi-tenant outline already recommends a Tenant entity and **no forked apps** ([command-multi-tenant-subscription-outline.md](../../../docs/architecture/command-multi-tenant-subscription-outline.md)).

Clients will have **different EWD packs** (which forms, photos on the record, exclusions). That must not become forty copies of the Next.js app.

## Decision

### 1. One codebase, named client containers

**Do not** fork the EWD per client (no per-customer git repo, no per-customer Next.js binary as the default).

Each paying operator is a **named container**:

| Layer | Meaning |
|-------|---------|
| **Identity** | Stable `tenant_id` (UUID, never reused), legal name, short slug |
| **Config pack** | Versioned inclusions: photo retain, form modules, checklist content, add-ons |
| **Data** | Every sheet, driver, user assignment, audit row carries `tenant_id` |
| **File** | PDF, SoR extract, Plan C drive stamped with legal name + `tenant_id` + **config pack version** |
| **Deploy (optional later)** | Same app; host/slug may resolve tenant (e.g. `acme.ewd.circadia24.com`) |

A “customised EWD” is a **config pack**, not a custom binary. Rule engines and event JSON stay shared so a restore in year three still works.

### 2. Client identity on every file (non-negotiable)

Every weekly PDF, roadside cover (where it is that driver’s operator), SoR pack, and Plan C exhibit **must** show:

- Client **legal name** (who the record belongs to)
- `tenant_id`
- Driver, `weekStarting`, sheet id (already exist)
- **Config pack version** (e.g. photos not retained under pack v2)
- Circadia product line + generated timestamp

Without this, Plan C is “some Circadia JSON.” With it, it is **that operator’s diary for week X under pack vN**.

### 3. Isolation is a tier, not a different product

Align with the Command outline:

| Tier | When |
|------|------|
| **Shared Neon + `tenant_id` + selective RLS** | Default (SMB / first 40-driver fleets) |
| **Dedicated Neon project / branch** | Upgrade when a client needs a harder wall |
| **Plan C exhibit** | Per-client **extract** + drive + **that client’s key** — never a raw shared `pg_dump` |

Plan B (encrypted platform dump → R2) remains Circadia DR. It is **not** what is handed to a court.

### 4. Config pack owns commercial switches

Photo retain, form list, and similar inclusions are **per container**, not global `SystemPolicy` forever. Replacing the singleton is part of implementing this ADR (Command outline Phase 1).

### 5. Interim (first official driver, before Tenant table)

Until the model exists:

- Choose the client **legal name** and slug.
- Stamp that name on Export PDF and on any Plan C folder/drive.
- **Do not** put a second company’s drivers on the same deployment as if they were isolated.

This interim stamp is a bridge, not a substitute for `tenant_id` on the sheet row.

## Consequences

### Positive

- PDFs, email, Plan C, and photo add-on share one identity story.
- Fleet scale does not require forked EWD apps.
- Dedicated DB later is the same container, harder isolation.

### Trade-offs

- Shared Neon must not leak rows across `tenant_id` (RLS / query discipline).
- Config pack version must be **frozen on the sheet at attest** (or recorded in audit) so a later pack change does not rewrite history.
- Host-per-client is optional chrome; identity in the **data** is mandatory.

## Non-goals

- Claiming NHVR-approved EWD (ADR 0001).
- Implementing billing in this ADR (subscription outline Phase 4).
- Making a home server the live store (Plan C is exhibit/spare only).

## Implementation notes (when built)

1. `Tenant` (or Organisation) row: legal name, slug, `tenant_id`, isolation tier, current config pack id.  
2. `User`, `Driver`, `FatigueSheet`, checklist-related rows: `tenant_id`.  
3. At week attest: persist `config_pack_version` (and tenant legal name snapshot) on the sheet.  
4. `renderPdfHtml` / jsPDF / roadside cover / SoR extract / Plan C manifest read those fields.  
5. Photo retain and form modules read the tenant pack, not a global boolean only.  
6. Plan C extract: `WHERE tenant_id = ?` only.

Production DB/env/domain changes still need **explicit owner approval** per production-change rules.

## References

- [ewd-record-custody-and-pdf-delivery.md](../product/ewd-record-custody-and-pdf-delivery.md) — custody, forced PDF, photos, Plan C §13  
- [command-multi-tenant-subscription-outline.md](../../../docs/architecture/command-multi-tenant-subscription-outline.md) — Tenant entity, Option A/B/C isolation  
- [ADR 0001](./0001-multi-jurisdiction-fatigue-architecture.md) — EWD positioning  
- [ADR 0002](./0002-managed-postgres-and-data-access.md) — Postgres SoR; SharePoint publish-only  
