# Product surfaces: Legacy / EWD / Enterprise

**Status:** Soft split in code (env + Host). Domain cutover is ops — needs explicit approval per host/env.  
**Last updated:** 2026-08-25

## Hosts

| Host | Surface | Product |
|------|---------|---------|
| `legacy.circadia24.com` | `legacy` | Combined driver + manager (parked original). Not the paper Helper app. |
| `ewd.circadia24.com` | `ewd` | Driver PWA (Electronic Work Diary) |
| `enterprise.circadia24.com` | `enterprise` | Fleet manager/owner + APIs (all current manager functions) |
| `staff-desk.circadia24.com` | `circadia` | Circadia staff desk (desktop PWA). `admin.circadia24.com` 308s here. |
| `command.circadia24.com` | — | Circadia Command (unchanged) |
| `helper.circadia24.com` | — | **Paper Helper app** (`wa-fatigue-sheet-helper`). Never this project. |

Unknown hosts (including `localhost`) still default to **legacy** behaviour. `www.circadia24.com` is the marketing site.

**Not the same as a client container.** EWD vs Enterprise is which **product surface** a host serves. A paying operator is a **named container** (`tenant_id` + legal name + config pack) that can use both surfaces. See [client-named-ewd-container.md](./client-named-ewd-container.md) and [ADR 0005](../../app-next/docs/adr/0005-client-named-ewd-container.md).

## Env (per Vercel project / alias)

```bash
APP_SURFACE=legacy|ewd|enterprise|circadia
NEXT_PUBLIC_APP_SURFACE=legacy|ewd|enterprise|circadia   # lobby badge if Host inference unavailable
NEXTAUTH_URL=https://<that-host>/

# Cross-links when a path belongs on another product:
NEXT_PUBLIC_LEGACY_APP_URL=https://legacy.circadia24.com
NEXT_PUBLIC_EWD_APP_URL=https://ewd.circadia24.com
NEXT_PUBLIC_ENTERPRISE_APP_URL=https://enterprise.circadia24.com
NEXT_PUBLIC_CIRCADIA_DESK_URL=https://staff-desk.circadia24.com
```

If `APP_SURFACE` / `NEXT_PUBLIC_APP_SURFACE` are unset, middleware and the home page infer from `Host` (`legacy.` / `ewd.` / `enterprise.` / `staff-desk.`). Otherwise default is **legacy**. The `staff-desk.` host always maps to **circadia**, even when `APP_SURFACE=legacy` on the shared Vercel project. The old `admin.` host 308s to staff-desk. `helper.circadia24.com` is not inferred here.

## Behaviour

| Surface | Lobby | Page gates |
|---------|-------|------------|
| **legacy** | Driver + Manager + Owner | All routes |
| **ewd** | Driver only | `/driver`, `/sheets*`; manager/admin → Enterprise URL (if set) |
| **enterprise** | Manager + Owner | Manager/admin + `/sheets/[id]*` for review; `/driver` and `/sheets` list/new → EWD URL (if set) |
| **circadia** | None (desk sign-in) | `/circadia` is the staff desk. Host root `/` rewrites to the desk. Other random paths redirect to `https://www.circadia24.com`. Never funnel www `/circadia` to the staff desk. |

APIs remain on **enterprise** (and legacy) so connected EWD can sync. Route handlers keep existing auth.

## Ops checklist (do not run without owner approval)

1. Add domain aliases: `legacy`, `ewd`, `enterprise`, `staff-desk` on this project. Never attach `helper.circadia24.com` here — that host is the paper Helper app.
2. Set `APP_SURFACE` + `NEXTAUTH_URL` (+ sibling `NEXT_PUBLIC_*_APP_URL`) per host. For `staff-desk.circadia24.com` on the shared project, Host inference is enough. Do **not** redirect `www.circadia24.com/circadia` to the staff desk; that host is the marketing site. Random non-desk paths on staff-desk go to `https://www.circadia24.com`.
3. Keep `www` as the marketing site. Do not treat `www` or `helper` as this combined lobby.
4. Point drivers at EWD; managers at Enterprise; Circadia staff at `staff-desk.circadia24.com`; paper Helper at `helper.circadia24.com`. Customer Owner tools stay at `/admin` on Enterprise.

## Code

- `src/lib/app-surface.ts` — resolution, lobby filter, path gates, sibling redirects
- `src/middleware.ts` — HTML path redirects by surface
- `src/components/lobby/AppLanding.tsx` — filtered cards + product badge
