# Auth, roles, and passwords

How sign-in works on **Circadia24** (`app-next`). Use this as the source of truth when onboarding testers or changing production env.

---

## Roles (SharePoint-style)

| Role | Lobby card | Typical person | User management |
|------|------------|----------------|-----------------|
| **Driver** | Driver | Field driver | Changes **own** password in **Settings → Change password** |
| **Manager** | Manager | Fleet supervisor | Adds/edits **Approved Drivers**; sets/resets **driver** passwords (shown once) |
| **Owner** | Owner | IT / external admin | **Add managers**; Owner console user delete; same driver tools as manager |

Managers **cannot** create other managers. Owners **cannot** delete their own account or the last owner.

**Multi-client:** every user belongs to one `Tenant`. Managers and owners only see drivers, sheets, and users in their own client. Circadia staff listed in `CIRCADIA_PLATFORM_ADMIN_EMAILS` (or `User.platformAdmin`) open the **Circadia staff desk** desktop PWA at **https://staff-desk.circadia24.com** — it is not linked from the product lobby or the fleet Owner console (`/admin` on Enterprise). A paused client cannot sign in (Circadia staff still can). Existing data backfills to `tenant_default`.

---

## Production sign-in (https://www.circadia24.com)

1. Open the lobby and choose **Driver**, **Manager**, or **Owner**.
2. Sign in with **email + per-user password** (minimum 6 characters).
3. **Forgot password?** on the sign-in form emails a one-hour reset link (requires `RESEND_API_KEY` + `EMAIL_FROM`). If email is not configured, the form tells the user to ask their manager (drivers) or owner (managers).
4. **Drivers** must be on **Approved Drivers** with a matching email and **Active** status.

**Production does not use a shared fleet password** unless you explicitly set `CIRCADIA_ALLOW_SHARED_LOGIN_PASSWORD=true` on Vercel (not recommended for pilot).

### Setting passwords (production)

| Account | Who sets password | Where |
|---------|-------------------|--------|
| Driver | Manager or owner | **Approved Drivers** → add/edit → **Set login password** |
| Driver (self) | Driver | **Settings → Change password** (needs current password), or **Forgot password?** on lobby sign-in |
| Manager | Owner only | **Add managers** → create or **Edit** → reset password; managers can also use **Forgot password?** |
| Owner | DBA / one-off script | Bootstrap only; then **Forgot password?** or a future self-service change |

When an admin sets a password, a **show-once** dialog appears — copy it immediately; it cannot be viewed again.

### Optional: pilot email allow-list

Set on Vercel Production only when you want to hard-lock sign-in:

```text
CIRCADIA_ALPHA_ALLOWLIST=driver@example.com,manager@example.com
```

When set, only listed emails can sign in (after password + roster checks). When **unset**, any valid roster/account may sign in.

### Required production env

| Variable | Example |
|----------|---------|
| `NEXTAUTH_URL` | `https://www.circadia24.com` |
| `NEXTAUTH_SECRET` | long random string |
| `DATABASE_URL` | Neon PostgreSQL |

**Do not set** on Production: `NEXTAUTH_CREDENTIALS_PASSWORD`, `NEXTAUTH_ALLOW_DEV_LOGIN`, `NEXTAUTH_DEV_BYPASS_SECRET`.

See `.env.example` for the full list.

---

## Local development

1. Copy `.env.example` → `.env.local`.
2. Set `NEXTAUTH_SECRET` and optionally `NEXTAUTH_CREDENTIALS_PASSWORD` (shared test password for seed users without bcrypt hashes).
3. `npm run db:seed` — creates `driver@test.local`, `manager@test.local`, etc.
4. Sign in at http://localhost:3000:
   - Seed emails + `NEXTAUTH_CREDENTIALS_PASSWORD`, **or**
   - Blank email/password in `npm run dev` (dev-only), **or**
   - Per-user password if set on Approved Drivers in local DB.

Preview deployments may use `NEXTAUTH_ALLOW_DEV_LOGIN` — still **blocked when `NODE_ENV=production`**.

---

## Owner console

- **URL:** `/admin/security` (Owner lobby card).
- **Title:** Owner console — operator name, lockdown, user lists, audit export.
- **Operator name:** organisation legal name (`Tenant.legalName`), printed as OPERATOR on weekly trip sheet PDFs. Owners PATCH `/api/admin/organisation`. Circadia staff can still edit it on Staff Desk client detail.
- **First owner:** `OWNER_SEED_EMAIL` + claim flow, or promote via DB/script.
- **Cleanup:** Delete dev/test users (owners, managers, drivers) from the lists — not yourself or the last owner.

---

## Operational scripts (not for routine use)

- `scripts/bootstrap-pilot-passwords.mjs` — one-off password/role setup against `DATABASE_URL` (requires `--env-file=.env.production.local` or similar). Use only with explicit approval for production DB writes.

---

## Related code

| Area | Path |
|------|------|
| Credentials auth | `src/lib/auth.ts` |
| Roster gate (drivers) | `src/lib/driver-login-gate.ts` |
| Password helpers | `src/lib/user-password.ts`, `src/lib/account-password-admin.ts` |
| Forgot / reset password | `src/lib/password-reset.ts`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/reset-password` |
| Alpha allow-list | `src/lib/auth-alpha-allowlist.ts` |
| Middleware / headers | `src/middleware.ts` |
| Production env guards | `src/lib/auth-env.ts` |
