# Missing spec parts

**Status: Categories A–I merged 2026-06-11.** Spec is implementation-ready at the architecture level.

## Remaining work (engineering, not Gemini)

- [ ] Scaffold `circadia-command` Next.js app (Sections 4, 9)
- [ ] Implement API gateway handlers from OpenAPI
- [ ] Railway SSE worker + Redis
- [ ] Railway identity sync worker (adapted SQL — no `Driver.tenant_id`)
- [ ] Apply SQL migrations `001`–`005` on Neon
- [ ] Product approval for 3 proposed `app-next` FRMS routes (Section 10)
- [ ] Create `circadia_edge_ingress` DB role + grants

## Optional follow-up for Gemini

Only if you need deeper detail:

```
Expand implementation detail for:
1. Neon GRANT statements for circadia_edge_ingress role
2. Exact SQL for triage queue cursor pagination query
3. Redis channel naming convention for SSE fan-out
Do not repeat sections already in MASTER_SPEC.md.
```
