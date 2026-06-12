# Gemini spec ↔ app-next schema adaptations

Gemini assumes customer schema fields that **do not exist today**. Implementations must use these adaptations.

| Gemini assumption | app-next reality | Adaptation |
|-------------------|------------------|------------|
| `Driver.tenant_id` | **Missing** | Pilot: fixed `tenant_cuid` + `tenant_id_uuid` per org in sync worker env |
| `User.role = 'FLEET_MANAGER'` | Role is `"manager"` | Manager validation query uses `role = 'manager'` |
| Trigger on `"Driver"` | Isolation rule | Railway sync job only (no customer triggers) |
| `ON CONFLICT (driver_cuid)` | Was not unique | Added `005_identity_map_extensions.sql` |
| Driver HUD via WebSocket | Spec also mentions SSE for operators | Driver: WebSocket on Railway; operators: SSE |
| 3 new `app-next` FRMS routes | Zero UI leakage goal | **Requires explicit approval** — see MASTER_SPEC Section 10 |
