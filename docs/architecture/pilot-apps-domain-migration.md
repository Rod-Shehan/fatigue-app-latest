# Pilot apps domain migration strategy

**Status:** Draft — pending professional advice before implementation  
**Last updated:** 2026-07-07  
**Scope:** Circadia **Manager** (`app-next`) and **Command** (`circadia-command`) production hosting

---

## 1. Goal

Free the primary marketing domains for upcoming public websites while keeping Manager and Command fully operational for the pilot.

| Domain (today) | App | Vercel project |
|----------------|-----|----------------|
| `https://www.circadia24.com` | Manager (`app-next`) | app-next |
| `https://command.circadia24.com` | Command (`circadia-command`) | circadia-command |

**Target outcome:**

| Domain (proposed) | Purpose |
|-------------------|---------|
| `circadia24.com` / `www.circadia24.com` | Marketing / corporate website |
| `manager.pilot.circadia24.com` (example) | Manager production |
| `command.pilot.circadia24.com` (example) | Command production |

Exact subdomain names are **TBD** after professional review. Alternatives are listed in §4.

---

## 2. Why subdomain migration (recommended)

Command and Manager are **separate Next.js apps** on **separate Vercel projects**. They share Neon Postgres and communicate via environment variables.

### Recommended: dedicated pilot subdomains

Examples: `manager.pilot.circadia24.com`, `command.pilot.circadia24.com`.

**Advantages**

- No `basePath` changes in either codebase
- Session cookies, NextAuth, service worker, and Web Push continue to work with minimal changes
- Migration is mostly **DNS + Vercel domains + env vars** plus a small code cleanup
- Low risk to Command mobile PWA and overnight alerts

**Estimated effort:** ~½–1 day operations + one small code PR

### Not recommended (unless explicitly required): paths on marketing root

Examples: `circadia24.com/manager`, `circadia24.com/command`.

**Why this is harder**

- Vercel allows one project per apex domain unless a **gateway** project handles rewrites
- Both apps need `basePath`, `assetPrefix`, cookie paths, `NEXTAUTH_URL`, PWA manifest `scope`, service worker scope, and push subscription re-registration
- Higher regression risk for Command desk audio, SSE, and Android background alerts

**Estimated effort:** ~3–5 days plus extended QA

---

## 3. Current coupling (must update on move)

### 3.1 Vercel environment variables

| Variable | Project | Current typical value | Update to |
|----------|---------|----------------------|-----------|
| `NEXTAUTH_URL` | app-next | `https://www.circadia24.com` | New Manager URL |
| `NEXT_PUBLIC_APP_URL` | app-next | (if set) | New Manager URL |
| `COMMAND_APP_URL` | app-next | `https://command.circadia24.com` | New Command URL |
| `APP_NEXT_URL` | circadia-command | `https://www.circadia24.com` | New Manager URL |

Other vars (`DATABASE_URL`, `COMMAND_SESSION_SECRET`, VAPID keys, `TEST_INCIDENT_INTERNAL_SECRET`, etc.) are **unchanged** — same Neon, same secrets.

### 3.2 Hardcoded URLs in code (replace with env)

| File | Current |
|------|---------|
| `app-next/src/components/manager/TestDeskPanel.tsx` | `commandTriageHref` default → `command.circadia24.com` |
| `circadia-command/src/components/admin/CommandTestDeskPanel.tsx` | Link to `www.circadia24.com/manager/alerts` |
| `circadia-command/src/lib/test-incident-client.ts` | Fallback `APP_NEXT_URL` → `www.circadia24.com` |
| `app-next/next.config.js` | Default `NEXTAUTH_URL` → `www.circadia24.com` |

**Suggested follow-up:** add `NEXT_PUBLIC_COMMAND_APP_URL` and `NEXT_PUBLIC_MANAGER_APP_URL` for client-side links.

### 3.3 External integrations

| Integration | Action on cutover |
|-------------|-------------------|
| Autonomise / camera **webhooks** | Re-register webhook URL if it points at `www.circadia24.com` |
| Operator bookmarks | Communicate new URLs |
| Command **PWA** (home screen) | Reinstall from new `/install` URL |
| **Web Push** subscriptions | Operators re-enable “Background alerts” on new origin |
| Vendor / partner documentation | Update any published pilot URLs |

### 3.4 What does **not** change

- Neon `DATABASE_URL` / `DATABASE_URL_UNPOOLED`
- SQL migrations (`npm run db:apply-sql` from `circadia-command`)
- Git repo structure or Vercel root directories (`app-next/`, `circadia-command/`)
- Operator accounts, lifecycle data, or ingest pipeline logic

---

## 4. Naming options (for professional review)

| Option | Manager | Command | Notes |
|--------|---------|---------|-------|
| **A — Pilot subdomains** (recommended) | `manager.pilot.circadia24.com` | `command.pilot.circadia24.com` | Clear separation from marketing |
| **B — Ops subdomains** | `manager.ops.circadia24.com` | `command.ops.circadia24.com` | Same pattern, different label |
| **C — Separate domain** | `manager.circadiaops.com` | `command.circadiaops.com` | Requires new domain purchase + DNS |
| **D — Paths on ops host** | `ops.circadia24.com/manager` | `ops.circadia24.com/command` | Needs `basePath` on both apps |
| **E — Paths on marketing root** | `circadia24.com/manager` | `circadia24.com/command` | Gateway + `basePath`; highest effort |

**Questions for advisor**

1. Branding: should pilot URLs be visibly “internal” (`pilot`, `ops`) or neutral (`app`)?
2. Compliance / contracts: do any agreements reference `www.circadia24.com` or `command.circadia24.com`?
3. SSO / identity: any future IdP allow-lists tied to current hostnames?
4. Webhook URLs: who controls Autonomise registration, and is downtime during switch acceptable?
5. Redirect policy: temporary 301 from old URLs, and for how long?

---

## 5. Target architecture

```
circadia24.com / www          →  Marketing site (new Vercel project or other host)

manager.pilot.circadia24.com  →  app-next (Manager)
command.pilot.circadia24.com  →  circadia-command (Command)

Both apps  →  shared Neon Postgres
app-next   →  COMMAND_APP_URL  →  Command (push dispatch, etc.)
circadia-command  →  APP_NEXT_URL  →  Manager (test desk proxy, etc.)
```

---

## 6. Implementation phases (when approved)

### Phase 0 — Decide URLs

- Confirm final hostnames with legal / brand / ops advisor
- Record in this doc and in Vercel project settings

### Phase 1 — Parallel hosting (no cutover)

1. Add **new** domains to existing Vercel projects (keep old aliases live)
2. Update env vars on **preview** or a staging alias first if available
3. Verify:
   - Manager: sign-in, live alerts, test desk
   - Command: login, triage, SSE, simulate ingest, background push
   - Cross-app: test incident inject (Manager → Command lifecycle + push)

### Phase 2 — Code + env production deploy

1. Merge env-driven URL cleanup (§3.2)
2. Set production env vars (§3.1)
3. Redeploy **both** Vercel projects

### Phase 3 — Cutover

1. Update external webhooks and partner docs
2. Notify operators (re-login, PWA reinstall, re-enable background alerts)
3. Remove old domain aliases from Vercel:
   - `www.circadia24.com` from app-next
   - `command.circadia24.com` from circadia-command
4. Point `circadia24.com` / `www` at marketing site

### Phase 4 — Redirects (optional, 2–4 weeks)

- `command.circadia24.com` → new Command URL
- `www.circadia24.com/manager/*` → new Manager URL (if deep links existed)

Command PWA may not follow redirects reliably; treat redirects as convenience only.

---

## 7. Operator communication checklist

- [ ] New Manager URL and bookmark
- [ ] New Command URL and `/install` for phones
- [ ] Tap speaker icon + enable background alerts again
- [ ] Expect to sign in again (cookies are origin-specific)
- [ ] Old home-screen icon can be removed after new install

---

## 8. Smoke test checklist (post-migration)

| Test | Manager | Command |
|------|---------|---------|
| Login | ✓ | ✓ |
| Live alerts queue | ✓ | — |
| Triage queue + claim | — | ✓ |
| SSE live indicator | — | ✓ |
| Desk alarm (foreground) | — | ✓ |
| Background push (locked phone) | — | ✓ |
| Test desk inject | ✓ | ✓ (owner) |
| Simulate edge ingest | — | ✓ |
| Incident activity timeline | — | ✓ |
| Webhook ingest (real event) | ✓ | ✓ |

---

## 9. Rollback

If issues occur after cutover:

1. Re-attach old Vercel domain aliases (`www`, `command`)
2. Revert env vars to previous URLs
3. Redeploy both projects

Data in Neon is unaffected; rollback is DNS/env only.

---

## 10. Related documentation

| Doc | Location |
|-----|----------|
| Command Vercel deploy | `circadia-command/docs/DEPLOY_VERCEL.md` |
| Command test desk | `circadia-command/docs/TEST_DESK.md` |
| Manager auth / `NEXTAUTH_URL` | `app-next/docs/AUTH_AND_ROLES.md` |
| Incident routing overview | `app-next/docs/architecture/incident-routing-assembly.md` |
| Multi-tenant / subscription outline | `docs/architecture/command-multi-tenant-subscription-outline.md` |

---

## 11. Decision log

| Date | Decision | Owner |
|------|----------|-------|
| 2026-07-07 | Strategy documented; implementation **on hold** pending professional advice | — |
| | Final subdomain names | TBD |
| | Cutover date | TBD |
