# Driver Fatigue Log (Next.js – no Base44)

This is the same app converted to **Next.js + TypeScript + Prisma + NextAuth**, with no Base44 dependency.

## Quick start

1. **Install and set up env**
   ```bash
   cd app-next
   npm install
   cp .env.example .env.local
   ```
   Edit `.env.local`:
   - **NEXTAUTH_SECRET** (required): e.g. `openssl rand -base64 32`
   - **NEXTAUTH_CREDENTIALS_PASSWORD** (local dev only): optional shared password for seed users without per-user hashes — see `.env.example`

   **Auth & roles (production vs local):** see **docs/AUTH_AND_ROLES.md**

2. **Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Optional: seed sample data for user testing**
   ```bash
   npm run db:seed
   ```
   Creates sample drivers, regos, test users (`manager@test.local`, `driver@test.local`), and one draft sheet. Local sign-in: those emails + `NEXTAUTH_CREDENTIALS_PASSWORD` from `.env.local`, or set passwords via Approved Drivers.

4. **Run**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Use the **Driver** or **Manager** lobby card with a seeded or roster email and password (see **docs/AUTH_AND_ROLES.md**).

   **Product surfaces (Legacy / EWD / Enterprise):** see [`../docs/architecture/product-surfaces-legacy-ewd-enterprise.md`](../docs/architecture/product-surfaces-legacy-ewd-enterprise.md). Local default is **legacy** (combined app). To preview EWD-only lobby: `NEXT_PUBLIC_APP_SURFACE=ewd` in `.env.local`.

## Stack

- **Next.js** (App Router), **TypeScript**, **Tailwind**
- **Prisma** + **SQLite** (dev) or **PostgreSQL** (prod via `DATABASE_URL`)
- **NextAuth.js** (Credentials provider; add Google etc. in `src/lib/auth.ts`)
- **TanStack Query** for client data

## Fatigue Sheet UI

The sheet **list** and **drivers** pages are fully wired. The single-sheet **editor** (time grid, compliance panel, signature) lives in `src/components/fatigue/`. Use `api.sheets.get(id)`, `api.sheets.update(id, data)`, and `api.sheets.exportPdfUrl(id)` from `@/lib/api.ts`.

See **MIGRATION.md** in the repo root for the full conversion guide.

## Australia-wide architecture & approvals

- **ADR:** `docs/adr/0001-multi-jurisdiction-fatigue-architecture.md`  
- **WA rule source mapping:** `docs/regulatory/wa-commercial-vehicle-hours.md` (Reg 184E / OSH 3.132 operating standard — time requirements)  
- **Step-by-step roadmap & approval gates:** `docs/roadmap/approval-gates.md` (major changes need explicit **Approve: S#** before implementation)  
- **Product positioning:** `docs/product/positioning.md`  
- **Transition checklist:** `docs/architecture/australia-wide-transition.md`  
- **NHVR provisional pack (optional):** `docs/architecture/nhvr-provisional-pack.md` — set `NEXT_PUBLIC_NHVR_PROVISIONAL_RULES_ENABLED=true` and/or `NHVR_PROVISIONAL_RULES_ENABLED=true` to expose the second **Fatigue rules** option and accept `NHVR_PROVISIONAL` on the API (not a certified EWD).  
- **Roadside PDF / QR (optional):** `docs/architecture/roadside-pdf-s6.md` — PDF export includes a compliance summary; set `ROADSIDE_QR_IN_PDF_ENABLED=true` plus `ROADSIDE_SNAPSHOT_SECRET` (or `NEXTAUTH_SECRET`) and `NEXT_PUBLIC_APP_URL` to embed a QR linking to a time-limited read-only JSON snapshot.  
- **WA Commercial Driver's Medical (optional):** `docs/architecture/wa-cvd-medical-s7.md` — roster stores optional certificate expiry; sheets show reminders when the driver name matches the roster.
- **User guides:** `docs/user-guides/README.md` — driver UI (simple English, ESL) and manager UI (mid-level English). In-app: `/driver/guide`, `/driver/help`, `/manager/help`.

## User testing

See **USER_TESTING.md** for a short tester brief. Run `npm run db:seed` first for local sample data.

**Auth, passwords, owner/manager/driver roles:** **docs/AUTH_AND_ROLES.md**

## Production (Vercel)

The app deploys from GitHub on push to **`main`**.

- **Project:** `fatigue-app-latest`
- **Root directory:** `app-next`
- **Production URL:** https://www.circadia24.com

**Production env (required):** `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://www.circadia24.com`

**Per-user passwords** — set on Approved Drivers / Add managers; do **not** set `NEXTAUTH_CREDENTIALS_PASSWORD` on Production unless IT explicitly opts in via `CIRCADIA_ALLOW_SHARED_LOGIN_PASSWORD`. Optional pilot lock: `CIRCADIA_ALPHA_ALLOWLIST`.

Full checklist: **docs/AUTH_AND_ROLES.md** and **`.env.example`**.
