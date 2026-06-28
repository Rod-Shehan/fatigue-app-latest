# Migration: Base44 → Next.js + Prisma + Auth.js

This document describes the **target stack** and how to complete the conversion.

## Target stack (Cursor-friendly, no vendor lock-in)

| Layer      | Technology |
|-----------|------------|
| Framework | **Next.js 14** (App Router) |
| Language  | **TypeScript** |
| Database  | **Prisma** + **SQLite** (dev) / **PostgreSQL** (prod) |
| Auth      | **NextAuth.js** (v4; Credentials provider) |
| UI        | **React** + **Tailwind** + existing Radix/shadcn-style components |
| Data      | **TanStack Query** (unchanged) + new API client calling `/api/*` |

## Why this stack

- **Single codebase**: frontend and API in one repo; one `npm run dev`.
- **TypeScript end-to-end**: better editor support and fewer runtime errors.
- **No Base44 dependency**: your data and auth live in your DB and your app.
- **Standard and portable**: works in Cursor, VSCode, and any host (Vercel, Docker, VPS).

## New app location

The converted app lives in **`app-next/`**.

**Option 1 – Double-click launcher (Windows)**  
Double-click **`Start App (Next).bat`** in the project root. It will install deps, set up the DB, and open http://localhost:3000.

**Option 2 – Manual**
```bash
cd app-next
npm install
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET; optional NEXTAUTH_CREDENTIALS_PASSWORD for local dev — see app-next/docs/AUTH_AND_ROLES.md
npx prisma generate
npx prisma db push
npm run dev
```
Open http://localhost:3000. Sign in via the lobby (Driver/Manager/Owner) with seeded emails and local env password — see **app-next/docs/AUTH_AND_ROLES.md**.

## Data model (Prisma)

- **User** – from Auth.js (id, email, name, etc.).
- **Driver** – name, licenceNumber (optional), isActive; optional `userId` for per-user drivers.
- **FatigueSheet** – driverName, secondDriver, driverType, destination, weekStarting, **days** (JSON), status, signature (optional), signedAt (optional), createdById (optional).

`days` is stored as JSON to match your current shape (array of 7 day objects with work_time, breaks, non_work, events).

## Auth

- NextAuth Credentials (email + password) in `app-next/src/lib/auth.ts`.
- **Production:** per-user passwords; roles driver / manager / owner — see **app-next/docs/AUTH_AND_ROLES.md**.
- **Local:** optional `NEXTAUTH_CREDENTIALS_PASSWORD` in `.env.local` for seed users.

## Environment variables (app-next)

Create **`app-next/.env`**:

```env
# Database (SQLite for dev; use DATABASE_URL for Postgres in prod)
DATABASE_URL="file:./dev.db"

# Auth.js
NEXTAUTH_SECRET="generate-a-random-string-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional: credentials provider
# NEXTAUTH_CREDENTIALS_EMAIL=admin@example.com
# NEXTAUTH_CREDENTIALS_PASSWORD=secret
```

For production, set `DATABASE_URL` to PostgreSQL, `NEXTAUTH_URL=https://www.circadia24.com`, and per-user passwords (not shared fleet password). See **app-next/docs/AUTH_AND_ROLES.md**.

## API surface (replaces Base44 SDK calls)

| Old (Base44) | New (Next.js API) |
|--------------|-------------------|
| `base44.entities.Driver.list()` | `GET /api/drivers` |
| `base44.entities.Driver.create(data)` | `POST /api/drivers` |
| `base44.entities.Driver.update(id, data)` | `PATCH /api/drivers/[id]` |
| `base44.entities.Driver.delete(id)` | `DELETE /api/drivers/[id]` |
| `base44.entities.FatigueSheet.list()` | `GET /api/sheets` |
| `base44.entities.FatigueSheet` get/create/update/delete | `GET/POST/PATCH/DELETE /api/sheets` and `GET/POST/PATCH/DELETE /api/sheets/[id]` |
| `base44.functions.invoke('exportFatigueSheet', { sheetId })` | `GET /api/sheets/[id]/export` (returns PDF) |

The frontend uses a small **API client** (`src/lib/api.ts`) that calls these routes with `fetch`; TanStack Query then uses that client.

## Completing the migration

1. **Run the app** from `app-next/` and confirm auth, drivers, and sheets work.
2. Add or adjust any UI in `app-next/src/components` and `app-next/src/app/...` as needed; use the API client in `@/lib/api.ts`.
