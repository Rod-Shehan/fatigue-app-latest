# User testing guide

Short brief for testers. Full auth/role detail: **docs/AUTH_AND_ROLES.md**.

---

## 1. Where to go

| Environment | URL |
|-------------|-----|
| **Production (pilot)** | https://www.circadia24.com |
| **Local** | http://localhost:3000 (after `npm run dev` in `app-next`) |
| **Vercel preview** | URL your facilitator shares |

---

## 2. How to sign in

1. Open the lobby.
2. Tap **Driver**, **Manager**, or **Owner** (match your account type).
3. Enter the **email and password** your facilitator gave you (each person has their own password).

**Drivers:** your email must be on **Approved Drivers** (active). If sign-in fails, ask your manager to add you or reset your password.

**Do not** use a shared “fleet password” on production — that mode is disabled unless IT explicitly turns it on.

---

## 3. Roles and first-time setup

| Role | Facilitator setup before you test |
|------|-----------------------------------|
| **Driver** | On Approved Drivers: name, email, active, password set (you should change it under **Settings → Change password**) |
| **Manager** | Owner creates account under **Add managers** with email + temporary password |
| **Owner** | IT promotes an owner account; you use the **Owner** lobby card → **Owner console** (`/admin/security`) |

Managers manage drivers and fleet data. Owners manage managers and org lockdown. See **docs/AUTH_AND_ROLES.md** for the full hierarchy.

---

## 4. What to try (goals)

- **Drivers:** Create or open a fatigue sheet, log work and breaks, mark complete, export PDF; try **Settings → Change password**.
- **Managers:** Manager dashboard, compliance, Approved Drivers, regos, event map / alerts as enabled.
- **Owners:** Owner console — review user lists, optional lockdown toggles (do not enable without coordination).

One-sentence goal: **Log a week of work/breaks and confirm compliance and export behave as expected.**

---

## 5. Sample data (local only)

Facilitator runs from `app-next`:

```bash
npm run db:seed
```

Creates sample drivers, regos, `driver@test.local`, `manager@test.local`, and a draft sheet. Local sign-in uses `.env.local` → `NEXTAUTH_CREDENTIALS_PASSWORD` or passwords set in the UI — **not** the same as production.

---

## 6. Empty app?

- **Drivers:** **Your sheets** → **Start New Week**.
- **Managers:** Add **drivers** and **regos** from the manager area. Compliance and map need sheets with logged time.

---

## 7. Who to contact

For broken flows, wrong behaviour, or access issues, contact **[your team contact / project lead]**.
