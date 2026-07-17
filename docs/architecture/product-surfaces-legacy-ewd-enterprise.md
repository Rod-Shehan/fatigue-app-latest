# Product surfaces: Legacy / EWD / Enterprise

**Status:** Soft split in code (env + Host). Domain cutover is ops — needs explicit approval per host/env.  
**Last updated:** 2026-07-17

## Hosts

| Host | Surface | Product |
|------|---------|---------|
| `legacy.circadia24.com` | `legacy` | Combined driver + manager (parked Version 1) |
| `ewd.circadia24.com` | `ewd` | Driver PWA (Electronic Work Diary) |
| `enterprise.circadia24.com` | `enterprise` | Fleet manager/owner + APIs (all current manager functions) |
| `command.circadia24.com` | — | Circadia Command (unchanged) |

Until aliases are attached, keep serving the combined app from the current production host; it defaults to **legacy** behaviour.

## Env (per Vercel project / alias)

```bash
APP_SURFACE=legacy|ewd|enterprise
NEXT_PUBLIC_APP_SURFACE=legacy|ewd|enterprise   # lobby badge if Host inference unavailable
NEXTAUTH_URL=https://<that-host>/

# Cross-links when a path belongs on another product:
NEXT_PUBLIC_LEGACY_APP_URL=https://legacy.circadia24.com
NEXT_PUBLIC_EWD_APP_URL=https://ewd.circadia24.com
NEXT_PUBLIC_ENTERPRISE_APP_URL=https://enterprise.circadia24.com
```

If `APP_SURFACE` / `NEXT_PUBLIC_APP_SURFACE` are unset, middleware and the home page infer from `Host` (`legacy.` / `ewd.` / `enterprise.`). Otherwise default is **legacy**.

## Behaviour

| Surface | Lobby | Page gates |
|---------|-------|------------|
| **legacy** | Driver + Manager + Owner | All routes |
| **ewd** | Driver only | `/driver`, `/sheets*`; manager/admin → Enterprise URL (if set) |
| **enterprise** | Manager + Owner | Manager/admin + `/sheets/[id]*` for review; `/driver` and `/sheets` list/new → EWD URL (if set) |

APIs remain on **enterprise** (and legacy) so connected EWD can sync. Route handlers keep existing auth.

## Ops checklist (do not run without owner approval)

1. Add domain aliases: `legacy`, `ewd`, `enterprise` on the appropriate Vercel project(s).
2. Set `APP_SURFACE` + `NEXTAUTH_URL` (+ sibling `NEXT_PUBLIC_*_APP_URL`) per host.
3. Keep current `www` on **legacy** until EWD/Enterprise are verified.
4. Point drivers at EWD; managers at Enterprise; leave Legacy as fallback.

## Code

- `src/lib/app-surface.ts` — resolution, lobby filter, path gates, sibling redirects
- `src/middleware.ts` — HTML path redirects by surface
- `src/components/lobby/AppLanding.tsx` — filtered cards + product badge
